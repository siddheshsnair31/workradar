import { createRoot } from 'react-dom/client';
import { StoreProvider } from './store';
import { useRoute } from './router';
import { Dashboard } from './pages/Dashboard';
import { Feed } from './pages/Feed';
import { ItemDetail } from './pages/ItemDetail';
import { Search } from './pages/Search';
import { Settings } from './pages/Settings';
import { Toasts } from './components/ui';
import './styles.css';

function App() {
  const { segments } = useRoute();
  let page;
  switch (segments[0]) {
    case undefined: page = <Dashboard />; break;
    case 'feed': page = <Feed />; break;
    case 'item': page = <ItemDetail id={segments[1] || ''} />; break;
    case 'search': page = <Search />; break;
    case 'settings': page = <Settings />; break;
    default: page = <ItemDetail id="__missing__" />;
  }
  return <>{page}<Toasts /></>;
}

createRoot(document.getElementById('root')!).render(<StoreProvider><App /></StoreProvider>);
