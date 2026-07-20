import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { operatorLoginRequestSchema, type OperatorLoginRequest } from '@app/contracts';
import { api, ApiError } from '../app/api';
import { Button, Field, Notice, StatusBadge } from '../components/primitives';

export function LoginPage() {
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm<OperatorLoginRequest>({ resolver: zodResolver(operatorLoginRequestSchema) });
  const login = useMutation({ mutationFn: api.login, onSuccess: () => navigate('/operador/pedidos', { replace: true }) });
  const message = !login.isError ? null : login.error instanceof ApiError && login.error.network
    ? 'No pudimos conectar con el acceso de operador.'
    : login.error instanceof ApiError && login.error.status === 401
      ? 'Usuario o contraseña inválidos.'
      : login.error instanceof ApiError && login.error.status !== undefined
        ? 'El servicio de operaciones no está disponible en este momento.'
        : 'No pudimos completar el acceso de operador.';

  return <main className="operator-login"><section><StatusBadge tone="ember">Acceso de cocina</StatusBadge><p className="eyebrow">La Brasa</p><h1>El pase empieza acá.</h1><p>Usá las credenciales asignadas para organizar la cola de preparación y revisar la proyección.</p></section><section className="operator-login__form"><h2>Ingreso de operador</h2><form onSubmit={handleSubmit((values) => login.mutate(values))} noValidate><Field label="Usuario" autoComplete="username" error={errors.username?.message} {...register('username')} /><Field label="Contraseña" type="password" autoComplete="current-password" error={errors.password?.message} {...register('password')} />{message && <Notice tone="warm">{message}</Notice>}<Button type="submit" disabled={login.isPending}>{login.isPending ? 'Verificando…' : 'Entrar a operaciones'}</Button></form><small>La sesión se mantiene únicamente en una cookie segura; este navegador no guarda tokens.</small></section></main>;
}
