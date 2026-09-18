import { Redirect } from 'expo-router';

// This tab is intercepted in the tab bar (see _layout.tsx) and opens the
// publish flow as a modal instead. This file only covers direct navigation.
export default function PublishRedirect() {
  return <Redirect href="/listing/new" />;
}
