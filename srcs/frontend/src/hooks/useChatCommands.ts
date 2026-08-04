import { useState } from 'react';
import { Socket } from 'socket.io-client';

type UserProfile = { id: number; username: string; profileColor: string };

export function useChatCommands(
    channelId: number | null,
    users: UserProfile[],
    socketRef: React.RefObject<Socket | null>
) {
    const [cmdMsg, setCmdMsg] = useState('');
    const [error,  setError]  = useState('');

    function findUser(username: string): UserProfile | undefined {
        return users.find(u => u.username.toLowerCase() === username.toLowerCase());
    }

    async function handleCommand(raw: string) {
        const parts   = raw.slice(1).trim().split(' ');
        const cmd     = parts[0].toLowerCase();
        const args    = parts.slice(1);
        const token   = sessionStorage.getItem('token');
        if (!token || channelId === null)
            return;
        const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

        function ok(msg: string) { setCmdMsg(msg); setTimeout(() => setCmdMsg(''), 5000); }
        function err(msg: string) { setError(msg);  setTimeout(() => setError(''),  5000); }

        async function api(url: string, method: string, body?: object) {
            const res  = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
            const data = await res.json().catch(() => ({}));
            return { ok: res.ok, msg: data.message ?? '' };
        }

        if (cmd === 'help') {
            ok('Admin: /kick <user>  /mute <user> [min]  /pass <password>  /close  /(un)private\nUser:  /msg <user> <message>  /invite <user>  /add <user>  /(un)block <user>');
            return;
        }

        if (cmd === 'kick') {
            const target = findUser(args[0]);
            if (!target) { err(`User "${args[0]}" not found`); return; }
            const r = await api(`/api/chat/channels/${channelId}/kick/${target.id}`, 'DELETE');
            r.ok ? ok(`${target.username} has been kicked`) : err(r.msg || 'Error');
            return;
        }

        if (cmd === 'mute') {
            const target = findUser(args[0]);
            if (!target) { err(`User "${args[0]}" not found`); return; }
            const minutes = parseInt(args[1]) || 5;
            const r = await api(`/api/chat/channels/${channelId}/mute/${target.id}`, 'PATCH', { minutes });
            r.ok ? ok(`${target.username} muted for ${minutes} min`) : err(r.msg || 'Error');
            return;
        }

        if (cmd === 'pass') {
            const password = args[0] ?? null;
            const r = await api(`/api/chat/channels/${channelId}/password`, 'PATCH', { password });
            r.ok ? ok(password ? 'Password set' : 'Password removed') : err(r.msg || 'Error');
            return;
        }

        if (cmd === 'close') {
            const r = await api(`/api/chat/channels/${channelId}`, 'DELETE');
            r.ok ? ok('Channel closed') : err(r.msg || 'Error');
            return;
        }

        if (cmd === 'private') {
            const r = await api(`/api/chat/channels/${channelId}/privacy`, 'PATCH', { isPrivate: true });
            r.ok ? ok('Channel set to private') : err(r.msg || 'Error');
            return;
        }

        if (cmd === 'unprivate') {
            const r = await api(`/api/chat/channels/${channelId}/privacy`, 'PATCH', { isPrivate: false });
            r.ok ? ok('Channel set to public') : err(r.msg || 'Error');
            return;
        }

        if (cmd === 'msg') {
            const target = findUser(args[0]);
            if (!target) { err(`User "${args[0]}" not found`); return; }
            const content = args.slice(1).join(' ');
            if (!content) { err('Usage: /msg <user> <message>'); return; }
            if (!socketRef.current) return;
            socketRef.current.emit('sendDm', { targetUserId: target.id, content });
            ok(`DM sent to ${target.username}`);
            return;
        }

        if (cmd === 'invite') {
            const target = findUser(args[0]);
            if (!target) { err(`User "${args[0]}" not found`); return; }
            const r = await api(`/api/chat/channels/${channelId}/invite/${target.id}`, 'POST');
            r.ok ? ok(`${target.username} invited`) : err(r.msg || 'Error');
            return;
        }

        if (cmd === 'add') {
            const target = findUser(args[0]);
            if (!target) { err(`User "${args[0]}" not found`); return; }
            const r = await api(`/api/chat/friends/${target.id}`, 'POST');
            r.ok ? ok(`Friend request sent to ${target.username}`) : err(r.msg || 'Error');
            return;
        }

        if (cmd === 'block') {
            const target = findUser(args[0]);
            if (!target) { err(`User "${args[0]}" not found`); return; }
            const r = await api(`/api/chat/block/${target.id}`, 'POST');
            r.ok ? ok(`${target.username} blocked`) : err(r.msg || 'Error');
            return;
        }

        if (cmd === 'unblock') {
            const target = findUser(args[0]);
            if (!target) { err(`User "${args[0]}" not found`); return; }
            const r = await api(`/api/chat/block/${target.id}`, 'DELETE');
            r.ok ? ok(`${target.username} unblocked`) : err(r.msg || 'Error');
            return;
        }

        err(`Unknown command: /${cmd}. Type /help for the list.`);
    }

    return { handleCommand, cmdMsg, error, setCmdMsg, setError };
}
