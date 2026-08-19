import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import Home from './pages/Home'
import Login from './pages/Login'
import Cars from './pages/Cars'
import CarDetail from './pages/CarDetail'
import Care from './pages/Care'
import Claim from './pages/Claim'
import Bookings from './pages/Bookings'
import Settings from './pages/Settings'
import Audit from './pages/Audit'
import Admin from './pages/Admin'

export const router = createBrowserRouter(
  [
    { path: '/', element: <Home /> },
    { path: '/login', element: <Login /> },
    { path: '/admin', element: <Admin /> },
    {
      element: <AppShell />,
      children: [
        { path: 'cars', element: <Cars /> },
        { path: 'cars/:id', element: <CarDetail /> },
        { path: 'care', element: <Care /> },
        { path: 'claim', element: <Claim /> },
        { path: 'bookings', element: <Bookings /> },
        { path: 'settings', element: <Settings /> },
        { path: 'audit', element: <Audit /> },
      ],
    },
  ],
  { future: { v7_relativeSplatPath: true, v7_fetcherPersist: true } },
)
