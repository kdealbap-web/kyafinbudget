import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

export type WeddingAiAction = 'recommendations' | 'analysis';

export type WeddingAiPriority = 'high' | 'medium' | 'low';

export interface WeddingAiRecommendation {
  category: string;
  estimatedBudget: number;
  priority: WeddingAiPriority;
  tips: string[];
  riskFactors: string[];
}

export interface WeddingAiAnalysis {
  analysis: string;
  suggestions: string[];
  riskAlert?: string | null;
}

@Injectable({ providedIn: 'root' })
export class WeddingAiService {
  private readonly supabase = inject(SupabaseService);

  async generateRecommendations(params: {
    totalBudget: number;
    eventDate: string;
    preferences?: {
      priorityCategories?: string[];
      luxuryLevel?: 'economy' | 'standard' | 'luxury' | 'ultra-luxury';
      guestCount?: number;
    };
  }): Promise<WeddingAiRecommendation[] | string | null> {
    const { data, error } = await this.supabase.client.functions.invoke('wedding-ai', {
      body: {
        action: 'recommendations',
        totalBudget: params.totalBudget,
        eventDate: params.eventDate,
        preferences: params.preferences ?? {},
      },
    });

    if (error) {
      console.error('[WeddingAiService] Error recommendations:', error);
      return null;
    }

    return (data as { ok?: boolean; data?: unknown })?.data as
      | WeddingAiRecommendation[]
      | string
      | null;
  }

  async analyzeExpenses(expenses: Array<{
    category?: string | null;
    provider_name?: string | null;
    amount?: number | null;
    paid_amount?: number | null;
    remaining?: number | null;
    status?: string | null;
  }>): Promise<WeddingAiAnalysis | string | null> {
    const { data, error } = await this.supabase.client.functions.invoke('wedding-ai', {
      body: {
        action: 'analysis',
        expenses,
      },
    });

    if (error) {
      console.error('[WeddingAiService] Error analysis:', error);
      return null;
    }

    return (data as { ok?: boolean; data?: unknown })?.data as
      | WeddingAiAnalysis
      | string
      | null;
  }
}
