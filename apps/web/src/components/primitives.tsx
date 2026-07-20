import { forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: 'ember' | 'charcoal' | 'quiet';
};

export function Button({ tone = 'ember', className = '', children, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={`button button--${tone} ${className}`.trim()} {...props}>{children}</button>;
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
};

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field({ label, hint, error, id, className = '', ...props }, ref) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const descriptionId = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;

  return (
    <div className="field">
      <label className="field__label" htmlFor={fieldId}>{label}</label>
      <input ref={ref} id={fieldId} className={`field__input ${className}`.trim()} aria-describedby={descriptionId} aria-invalid={Boolean(error)} {...props} />
      {error ? <span className="field__error" id={descriptionId}>{error}</span> : hint ? <span className="field__hint" id={descriptionId}>{hint}</span> : null}
    </div>
  );
});

export function Notice({ children, tone = 'warm' }: { children: ReactNode; tone?: 'warm' | 'success' }) {
  return <aside className={`notice notice--${tone}`} role="status">{children}</aside>;
}

export function StatusBadge({ children, tone = 'ember' }: { children: ReactNode; tone?: 'ember' | 'herb' | 'charcoal' }) {
  return <span className={`status-badge status-badge--${tone}`}>{children}</span>;
}
