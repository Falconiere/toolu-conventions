/** `/` — the console home. A route file maps a URL to a domain screen, nothing more. */
import { createFileRoute } from '@tanstack/react-router';
import { HomeScreen } from '@/domains/home/screens/home-screen';

export const Route = createFileRoute('/')({
  component: HomeScreen,
});
