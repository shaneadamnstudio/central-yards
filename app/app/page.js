import { headers } from 'next/headers';
import Workspace from './components/Workspace';

export const dynamic = 'force-dynamic';

export default function Home() {
  const h = headers();
  const scope = h.get('x-cy-scope') || 'cy';
  return <Workspace scope={scope} />;
}
