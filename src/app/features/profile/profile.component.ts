import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { SupabaseService } from '../../core/services/supabase.service';
import { ProgressBarService } from '../../shared/services/progress-bar.service';
import { ToastService } from '../../shared/services/toast.service';
import { AppRole, getRoleLabel, Profile } from '../../domain/models/profile.model';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile.component.html',
})
export class ProfileComponent {
  private readonly supabase = inject(SupabaseService);
  private readonly progressBar = inject(ProgressBarService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly profile = computed(() => this.supabase.userProfile());
  readonly roleLabel = computed(() => getRoleLabel(this.profile()?.role ?? AppRole.User));
  readonly userInitial = computed(() => (this.profile()?.full_name || 'U').charAt(0).toUpperCase());

  readonly isSaving = signal(false);

  readonly form = this.fb.nonNullable.group({
    full_name: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.minLength(2),
      Validators.maxLength(60),
    ]),
  });

  constructor() {
    effect(() => {
      const p = this.profile();
      if (!p) return;
      this.form.patchValue({ full_name: p.full_name ?? '' }, { emitEvent: false });
      this.form.markAsPristine();
      this.form.markAsUntouched();
    });
  }

  resetForm(): void {
    const p = this.profile();
    this.form.patchValue({ full_name: p?.full_name ?? '' }, { emitEvent: false });
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  async save(): Promise<void> {
    const p = this.profile();
    if (!p) {
      this.toast.error('No se pudo cargar tu perfil.');
      return;
    }

    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const fullName = this.form.controls.full_name.value.trim();
    this.isSaving.set(true);
    this.progressBar.start();

    try {
      const updated = await this.supabase.update<Profile>('profiles', p.id, {
        full_name: fullName,
      });

      if (!updated) throw new Error('Perfil no retornado');
      this.supabase.userProfile.set(updated);

      this.toast.success('Tu perfil se actualizó correctamente.');
      this.progressBar.complete();
      this.form.markAsPristine();
    } catch (e: any) {
      this.progressBar.error();
      this.toast.error(e?.message ? `No se pudo guardar: ${e.message}` : 'No se pudo guardar tu perfil.');
    } finally {
      this.isSaving.set(false);
    }
  }
}