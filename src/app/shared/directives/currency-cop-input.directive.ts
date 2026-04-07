import {
  Directive,
  ElementRef,
  HostListener,
  forwardRef,
  inject,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Directive({
  selector: 'input[currencyCopInput]',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CurrencyCopInputDirective),
      multi: true,
    },
  ],
})
export class CurrencyCopInputDirective implements ControlValueAccessor {
  private readonly elementRef = inject(ElementRef<HTMLInputElement>);

  private onChange: (value: number) => void = () => {};
  private onTouched: () => void = () => {};

  private value = 0;
  private isFocused = false;

  writeValue(value: unknown): void {
    const next = this.coerceNumber(value);
    this.value = next;
    this.render();
  }

  registerOnChange(fn: (value: number) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.element.disabled = isDisabled;
  }

  @HostListener('focus')
  onFocus(): void {
    this.isFocused = true;
    this.element.inputMode = 'numeric';
    this.element.value = this.value > 0 ? String(this.value) : '';
  }

  @HostListener('blur')
  onBlur(): void {
    this.isFocused = false;
    this.onTouched();
    this.render();
  }

  @HostListener('input', ['$event'])
  onInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value ?? '';
    const digits = raw.replace(/\D/g, '');
    const next = digits ? Number(digits) : 0;
    this.value = isFinite(next) ? next : 0;
    this.onChange(this.value);

    if (this.isFocused) {
      this.element.value = digits;
    }
  }

  private render(): void {
    if (this.isFocused) return;
    this.element.value = this.value > 0 ? this.formatCop(this.value) : '';
  }

  private formatCop(value: number): string {
    const v = Math.trunc(Math.abs(value));
    const formatted = v.toLocaleString('es-CO', { maximumFractionDigits: 0 });
    return `$ ${formatted}`;
  }

  private coerceNumber(value: unknown): number {
    if (typeof value === 'number') return isFinite(value) ? value : 0;
    if (typeof value === 'string') {
      const digits = value.replace(/\D/g, '');
      const n = digits ? Number(digits) : 0;
      return isFinite(n) ? n : 0;
    }
    return 0;
  }

  private get element(): HTMLInputElement {
    return this.elementRef.nativeElement;
  }
}
