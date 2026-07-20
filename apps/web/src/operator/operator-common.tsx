import { Link } from 'react-router-dom';

export function UnauthorizedState() {
  return <section className="operator-state" aria-live="assertive"><p className="eyebrow">Sesión requerida</p><h1>Tu sesión de operaciones venció o no está disponible.</h1><p>No mostramos pedidos ni proyecciones hasta verificar nuevamente tus credenciales.</p><Link className="button button--ember" to="/operador/login">Ir al acceso de operador</Link></section>;
}

export function OperatorErrorState({ message, retry }: { message: string; retry(): void }) {
  return <section className="operator-state"><p className="eyebrow">Operaciones no disponibles</p><h1>{message}</h1><button className="button button--ember" type="button" onClick={retry}>Reintentar</button></section>;
}
