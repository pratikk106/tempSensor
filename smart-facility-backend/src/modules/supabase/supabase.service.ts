import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly client: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    const url =
      this.configService.get<string>('NEXT_PUBLIC_SUPABASE_URL')?.trim() ?? '';

    // Prefer secret/server key for backend usage when present.
    const key =
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY')?.trim() ||
      this.configService
        .get<string>('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY')
        ?.trim() ||
      '';

    this.client = createClient(url, key, {
      auth: {
        persistSession: false,
      },
    });
  }

  async onModuleInit() {
    // Lightweight call to validate credentials and connectivity.
    await this.client.auth.getSession();
  }

  getClient() {
    return this.client;
  }
}
