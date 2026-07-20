import { NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { LoginPage } from './login-page';
import { OrdersBoardPage } from './orders-board-page';
import { ProjectionBoardPage } from './projection-board-page';

function OperatorShell() {
  return <div className="operator-shell"><a className="skip-link" href="#operaciones">Saltar a operaciones</a><header className="operator-header"><NavLink className="operator-brand" to="/operador/pedidos"><span aria-hidden="true">LB</span><strong>La Brasa<br /><small>Operaciones</small></strong></NavLink><nav aria-label="Navegación de operaciones"><NavLink to="/operador/pedidos">Pedidos</NavLink><NavLink to="/operador/proyeccion">Proyección</NavLink></nav></header><main id="operaciones"><Outlet /></main></div>;
}

export function OperatorRoutes() {
  return <Routes><Route path="login" element={<LoginPage />} /><Route element={<OperatorShell />}><Route index element={<Navigate to="pedidos" replace />} /><Route path="pedidos" element={<OrdersBoardPage />} /><Route path="proyeccion" element={<ProjectionBoardPage />} /></Route></Routes>;
}
