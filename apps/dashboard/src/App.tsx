import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Overview from './pages/Overview';
import Agents from './pages/Agents';
import Jobs from './pages/Jobs';
import Intelligence from './pages/Intelligence';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Overview />} />
        <Route path="agents" element={<Agents />} />
        <Route path="jobs" element={<Jobs />} />
        <Route path="intel" element={<Intelligence />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
