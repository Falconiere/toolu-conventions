/** The console home screen. */
import { APP_ENV } from '@/constants/env';
import { icons } from '@/ui/theme/icons';
import { integrationCount } from '../integration-status';

export function HomeScreen() {
  return (
    <main className="band min-h-screen p-8">
      Hello from {'{{TOOLU_DISPLAY_NAME}}'} ({APP_ENV}; {integrationCount} integrations){' '}
      <span aria-hidden>{icons.check}</span>
    </main>
  );
}
