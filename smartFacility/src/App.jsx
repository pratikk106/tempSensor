import { useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'
import { useLottie } from 'lottie-react'
import { animated, useSpring, useTransition } from '@react-spring/web'
import pulseAnimation from './assets/pulse-lottie.json'
import './App.css'

function App() {
  const [rules, setRules] = useState([])
  const [alerts, setAlerts] = useState([])
  const [events, setEvents] = useState([])
  const [statusMap, setStatusMap] = useState({})
  const [form, setForm] = useState({
    name: '',
    eventType: 'temperature',
    operator: '>',
    threshold: 70,
    windowType: 'count',
    windowValue: 3,
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingRuleId, setEditingRuleId] = useState(null)

  const apiBase = useMemo(
    () => import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000',
    [],
  )

  const { View: HeroLottie } = useLottie({
    animationData: pulseAnimation,
    loop: true,
    autoplay: true,
  })

  useEffect(() => {
    const loadData = async () => {
      try {
        const [rulesRes, alertsRes] = await Promise.all([
          fetch(`${apiBase}/rules`),
          fetch(`${apiBase}/alerts`),
        ])

        if (rulesRes.ok) {
          const data = await rulesRes.json()
          setRules(data)
        }
        if (alertsRes.ok) {
          const data = await alertsRes.json()
          setAlerts(data)
        }
      } catch (e) {
        setError('Failed to load initial data')
      }
    }

    loadData()
  }, [apiBase])

  const heroSpring = useSpring({
    from: { opacity: 0, transform: 'translateY(16px)' },
    to: { opacity: 1, transform: 'translateY(0px)' },
    config: { tension: 180, friction: 20 },
  })

  const eventTransitions = useTransition(events.slice(0, 12), {
    keys: (item, index) => `${item.deviceId}-${item.timestamp}-${index}`,
    from: { opacity: 0, transform: 'translateY(8px)' },
    enter: { opacity: 1, transform: 'translateY(0px)' },
    leave: { opacity: 0, transform: 'translateY(-8px)' },
    trail: 40,
  })

  const alertTransitions = useTransition(alerts.slice(0, 10), {
    keys: (item) => item.id,
    from: { opacity: 0, transform: 'translateY(10px)' },
    enter: { opacity: 1, transform: 'translateY(0px)' },
    leave: { opacity: 0, transform: 'translateY(-10px)' },
    trail: 50,
  })

  useEffect(() => {
    const socket = io(apiBase)

    socket.on('event.received', (event) => {
      setEvents((prev) => [event, ...prev].slice(0, 30))
    })

    socket.on('event.processed', (event) => {
      setEvents((prev) => [{ ...event, processed: true }, ...prev].slice(0, 30))
    })

    socket.on('alert.created', (alert) => {
      setAlerts((prev) => [alert, ...prev].slice(0, 30))
    })

    socket.on('device.status', (payload) => {
      setStatusMap((prev) => ({
        ...prev,
        [payload.deviceId]: payload.status,
      }))
    })

    return () => {
      socket.disconnect()
    }
  }, [apiBase])

  const onCreateOrUpdateRule = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      const payload = {
        name: form.name,
        eventType: form.eventType,
        definition: {
          operator: form.operator,
          threshold: Number(form.threshold),
          window: {
            type: form.windowType,
            value: Number(form.windowValue),
          },
          action: 'ALERT',
        },
        isActive: true,
      }

      const method = 'POST'
      const url = editingRuleId
        ? `${apiBase}/rules/${editingRuleId}/update`
        : `${apiBase}/rules`

      const res = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.message || 'Failed to create rule')
      }

      const saved = await res.json()
      if (editingRuleId) {
        setRules((prev) => prev.map((rule) => (rule.id === editingRuleId ? saved : rule)))
      } else {
        setRules((prev) => [saved, ...prev])
      }
      setForm((prev) => ({ ...prev, name: '' }))
      setEditingRuleId(null)
    } catch (err) {
      setError(err.message || 'Failed to create rule')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <animated.header style={heroSpring} className="hero">
        <div>
          <h1>Smart Facility Dashboard</h1>
          <p>Live monitoring for events, alerts, and device health.</p>
        </div>
        <div className="heroAnim">
          {HeroLottie}
        </div>
      </animated.header>

      {error ? <p className="error">{error}</p> : null}

      <section className="grid">
        <div className="card">
          <h2>Create Rule</h2>
          <form onSubmit={onCreateOrUpdateRule} className="form">
            <input
              placeholder="Rule name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
            <input
              placeholder="Event type"
              value={form.eventType}
              onChange={(e) => setForm((p) => ({ ...p, eventType: e.target.value }))}
              required
            />
            <div className="row">
              <select
                value={form.operator}
                onChange={(e) => setForm((p) => ({ ...p, operator: e.target.value }))}
              >
                <option value=">">&gt;</option>
                <option value=">=">&gt;=</option>
                <option value="<">&lt;</option>
                <option value="<=">&lt;=</option>
              </select>
              <input
                type="number"
                value={form.threshold}
                onChange={(e) => setForm((p) => ({ ...p, threshold: e.target.value }))}
              />
            </div>
            <div className="row">
              <select
                value={form.windowType}
                onChange={(e) => setForm((p) => ({ ...p, windowType: e.target.value }))}
              >
                <option value="count">count window</option>
                <option value="time">time window(sec)</option>
              </select>
              <input
                type="number"
                value={form.windowValue}
                onChange={(e) => setForm((p) => ({ ...p, windowValue: e.target.value }))}
              />
            </div>
            <button disabled={saving}>
              {saving ? 'Saving...' : editingRuleId ? 'Update Rule' : 'Create Rule'}
            </button>
          </form>

          <h3>Rules ({rules.length})</h3>
          <ul className="list">
            {rules.slice(0, 8).map((rule) => (
              <li key={rule.id}>
                <b>{rule.name}</b> [{rule.eventType}]&nbsp;
                <button
                  className="miniBtn"
                  type="button"
                  onClick={() => {
                    setEditingRuleId(rule.id)
                    setForm({
                      name: rule.name ?? '',
                      eventType: rule.eventType ?? 'temperature',
                      operator: rule.definition?.operator ?? '>',
                      threshold: rule.definition?.threshold ?? 70,
                      windowType: rule.definition?.window?.type ?? 'count',
                      windowValue: rule.definition?.window?.value ?? 3,
                    })
                  }}
                >
                  Edit
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h2>Live Event Feed</h2>
          <ul className="list">
            {eventTransitions((style, event, _, idx) => (
              <animated.li style={style} key={`${event.deviceId}-${event.timestamp}-${idx}`}>
                <span className="pill">event</span> {event.deviceId} | {event.type}={event.value} | ts:{event.timestamp}
              </animated.li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h2>Alerts ({alerts.length})</h2>
          <ul className="list">
            {alertTransitions((style, alert) => (
              <animated.li style={style} key={alert.id}>
                <span className="pill alert">alert</span> {alert.deviceId} | {alert.message}
              </animated.li>
            ))}
          </ul>
          <h3>Device Status</h3>
          <ul className="list">
            {Object.entries(statusMap).map(([deviceId, status]) => (
              <li key={deviceId}>
                {deviceId}: <b>{status}</b>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}

export default App
