import App from '../App'
import { auth } from '../auth'
import { checkUserAuthorization } from '../lib/actions'

export default async function Page() {
  const session = await auth();

  let isAllowed: boolean | null = null;
  if (session?.user?.email) {
    isAllowed = await checkUserAuthorization(session.user.email);
  }

  return <App initialSession={session} initialIsAllowed={isAllowed} />
}
