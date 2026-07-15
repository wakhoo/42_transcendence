import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type Me = { 
    id: number; 
    username: string; 
    email: string; 
    profileColor: string; 
    avatarUrl: string | null; 
    createdAt: string; 
};

type PublicUser = {
    id: number; 
    username: string; 
    profileColor: string; 
    avatarUrl: string | null; 
};

type FriendUser = { 
    id: number; 
    username: string; 
    profileColor: string; 
};

type Friendship = { 
    id: number; 
    status: 'pending' | 'accepted' | 'blocked'; 
    requester: FriendUser; 
    addressee: FriendUser; 
};

function authHeaders() {
    const token = sessionStorage.getItem('token');
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }; //vu qu'on envoie une requette avec un body faut mettre dans le header que c'est un json
}

export default function ProfilePage() {
    const [me, setMe]             = useState<Me | null>(null);
    const [allUsers, setAllUsers] = useState<PublicUser[]>([]);
    const [friends, setFriends]   = useState<Friendship[]>([]);
    const [pending, setPending]   = useState<Friendship[]>([]);
    const [username, setUsername] = useState('');
    const [email, setEmail]       = useState('');
    const [msg, setMsg]           = useState('');
    const navigate                = useNavigate();

    async function loadAll() {
        const token = sessionStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return; 
        }

        const [meRes, usersRes, friendsRes, pendingRes] = await Promise.all([ //ici je lance les requetes en meme temps (multi threading) et j'attends qu'elles aient toutes repondues
            fetch('/api/user/me',               { headers: authHeaders() }),
            fetch('/api/user',                  { headers: authHeaders() }),
            fetch('/api/chat/friends',          { headers: authHeaders() }),
            fetch('/api/chat/friends/pending',  { headers: authHeaders() }),
        ]);

        if (!meRes.ok) { //utile si token expire ou si le back ne repond pas
            navigate('/login'); 
            return; 
        }

        const meData: Me                = await meRes.json();
        const usersData: PublicUser[]   = usersRes.ok   ? await usersRes.json()   : [];
        const friendsData: Friendship[] = friendsRes.ok ? await friendsRes.json() : [];
        const pendingData: Friendship[] = pendingRes.ok ? await pendingRes.json() : [];

        setMe(meData);
        setUsername(meData.username);
        setEmail(meData.email);
        setAllUsers(usersData);
        setFriends(friendsData);
        setPending(pendingData);
    }

    useEffect(() => { loadAll(); }, []); // le [] c'est pour lancer loadAll au demarage

    async function saveProfile() {
        const res = await fetch('/api/user/me', { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ username, email })}); //stringify c'est pour transformer en json
        const data = await res.json();
        if (res.ok) {  //res.ok veut dire que le code http est compris entre 200 et 299 donc que tout s'est bien passe
            setMe(data); 
            setMsg('Profil mis a jour'); 
        }
        else setMsg(data.message ?? 'Erreur'); //dans le json de la requete retour message contient le code http et le message d'erreur lance par mes exceptions 
    }

    async function addFriend(userId: number) {
        const res = await fetch(`/api/chat/friends/${userId}`, { method: 'POST', headers: authHeaders() });
        const data = await res.json();
        setMsg(res.ok ? 'Invitation sent' : (data.message ?? 'Erreur'));
        if (res.ok) 
            loadAll();
    }

    async function acceptFriend(friendshipId: number) {
        const res = await fetch(`/api/chat/friends/${friendshipId}/accept`, { method: 'PATCH', headers: authHeaders() });
        setMsg(res.ok ? 'Friend accepted' : 'Erreur');
        if (res.ok) 
            loadAll();
    }

    async function removeFriend(friendshipId: number) {
        await fetch(`/api/chat/friends/${friendshipId}`, { method: 'DELETE', headers: authHeaders() });
        loadAll();
    }

    function friendOf(f: Friendship) { //fonction qui permet de savoir si la personne a envoye la demande ou l'a recu
        if (f.requester.id === me?.id)
            return f.addressee;
        return f.requester;
    }

    const acceptedIds = friends.map(f => friendOf(f).id); //on choppe ici un tableau d'ID de frienduser deja amis
    const pendingIds  = pending.map(f => f.requester.id); //idem avec les demandes en cours
    const friendIds   = new Set([...acceptedIds, ...pendingIds]); //on fusionne les deux tableaux d'ID dans un set
    
    const strangers = allUsers.filter(u => u.id !== me?.id && !friendIds.has(u.id)); //dans strangers on exclus de AllUsers nous meme nos amis et les demandes en cours

    return (
        <div style={{ padding: 20, fontFamily: 'monospace' }}>
            <button onClick={() => navigate('/dashboard')}>← Dashboard</button>
            <h1>Profil</h1>

            {msg && <p><b>{msg}</b></p>}

            <h2>Mon compte</h2>
            <p>ID : {me?.id} | Couleur : {me?.profileColor}</p>
            <label>Pseudo : <input value={username} onChange={e => setUsername(e.target.value)} /></label><br />
            <label>Email  : <input value={email}    onChange={e => setEmail(e.target.value)} /></label><br />
            <button onClick={saveProfile}>Sauvegarder</button>

            <h2>Demandes reçues ({pending.length})</h2>
            {pending.length === 0 && <p>Aucune</p>}
            {pending.map(f => (
                <p key={f.id}>
                    {f.requester.username}
                    {' '}<button onClick={() => acceptFriend(f.id)}>Accepter</button>
                    {' '}<button onClick={() => removeFriend(f.id)}>Refuser</button>
                </p>
            ))}

            <h2>Amis ({friends.length})</h2>
            {friends.length === 0 && <p>Aucun</p>}
            {friends.map(f => {
                const friend = friendOf(f);
                return (
                    <p key={f.id}>
                        {friend.username}
                        {' '}<button onClick={() => removeFriend(f.id)}>Retirer</button>
                    </p>
                );
            })}

            <h2>Ajouter un ami ({strangers.length} joueurs)</h2>
            {strangers.length === 0 && <p>Aucun joueur disponible</p>}
            {strangers.map(u => (
                <p key={u.id}>
                    {u.username}
                    {' '}<button onClick={() => addFriend(u.id)}>+ Ajouter</button>
                </p>
            ))}
        </div>
    );
}
