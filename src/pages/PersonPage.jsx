import { useSearchParams } from 'react-router-dom';
import PublicPerson from '../components/PublicPerson.jsx';
import { normalizeWebId } from '../lib/webId.js';

/** In-app profile for someone you opened from Discover or an invite. */
export default function PersonPage({ session, friends, onAddFriend, addingWebId, signedIn = true }) {
  const [params] = useSearchParams();
  const webId = normalizeWebId(params.get('webid') || '') || '';
  return (
    <PublicPerson
      webId={webId}
      session={session}
      friends={friends}
      onFollow={onAddFriend}
      followBusy={addingWebId === webId}
      signedIn={signedIn}
    />
  );
}
