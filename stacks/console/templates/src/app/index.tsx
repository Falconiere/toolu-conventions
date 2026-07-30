/** `/` — the console home. A route file maps a URL to a feature screen, nothing more. */
import { createFileRoute } from '@tanstack/react-router';
import { HomeScreen } from '@/features/home/screens/home-screen';

export const Route = createFileRoute('/')({
  component: HomeScreen,
});
