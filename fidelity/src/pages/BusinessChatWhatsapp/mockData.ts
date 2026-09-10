// types.ts
import userIcon from "@/assets/images/users/user_icon_profile.png";
export interface User {
    id: string;
    name: string;
    email: string;
    avatar: string;
    status: 'online' | 'offline' | 'away';
    lastSeen?: Date;

}

export interface Message {
    id: string;
    content: string;
    senderId: string;
    timestamp: Date;
    isRead: boolean;
    viewCount: number;
    attachmentType?: 'audio' | 'image' | null;
    attachmentUrl?: string;
    reactions?: Array<{
        userId: string;
        emoji: string;
    }>;

}

export interface Chat {
    id: string;
    participants: User[];
    messages: Message[];
    lastMessage?: Message;
    unreadCount: number;
    isPinned?: boolean; // <--- aggiunta

}

// mockData.ts
export const mockUsers: User[] = [
    {
        id: '1',
        name: 'Marco Rossi',
        email: 'marco.rossi@email.com',
        avatar: userIcon,
        status: 'online',
    },
    {
        id: '2',
        name: 'Laura Bianchi',
        email: 'laura.bianchi@email.com',
        avatar: userIcon,
        status: 'online',
    },
    {
        id: '3',
        name: 'Giuseppe Verdi',
        email: 'giuseppe.verdi@email.com',
        avatar: userIcon,
        status: 'away',
        lastSeen: new Date('2024-11-18T11:45:00'),
    },
    {
        id: '4',
        name: 'Sofia Ferrari',
        email: 'sofia.ferrari@email.com',
        avatar: userIcon,
        status: 'offline',
        lastSeen: new Date('2024-11-18T10:30:00'),
    },
];

export const mockMessages: Message[] = [
    {
        id: 'm1',
        content: 'Ciao! Come stai?',
        senderId: '2',
        timestamp: new Date('2024-11-18T09:00:00'),
        isRead: true,
        viewCount: 3,

    },
    {
        id: 'm2',
        content: 'Tutto bene grazie! Tu?',
        senderId: '1',
        timestamp: new Date('2024-11-18T09:02:00'),
        isRead: true,
        viewCount: 2,

    },
    {
        id: 'm3',
        content: 'Benissimo! Ho visto il progetto che hai mandato, è molto interessante.',
        senderId: '2',
        timestamp: new Date('2024-11-18T09:05:00'),
        isRead: true,
        viewCount: 2,
    },
    {
        id: 'm4',
        content: 'Ti mando un messaggio vocale per spiegare meglio',
        senderId: '1',
        timestamp: new Date('2024-11-18T09:10:00'),
        isRead: true,
        viewCount: 1,
        attachmentType: 'audio',
    },
    {
        id: 'm5',
        content: 'Perfetto! Guarda questa immagine del design',
        senderId: '2',
        timestamp: new Date('2024-11-18T09:15:00'),
        isRead: true,
        viewCount: 1,
        attachmentType: 'image',
        attachmentUrl: '/assets/images/project1.jpg',
    },
    {
        id: 'm6',
        content: 'Mi piace molto! Ottimo lavoro 👍',
        senderId: '1',
        timestamp: new Date('2024-11-18T09:20:00'),
        isRead: false,
        viewCount: 0,
        reactions: [
            { userId: '2', emoji: '❤️' },
            { userId: '3', emoji: '👍' },
        ],
    },
    {
        id: 'm7',
        content: 'Quando possiamo organizzare una call per discuterne?',
        senderId: '2',
        timestamp: new Date('2024-11-18T09:25:00'),
        isRead: false,
        viewCount: 0,
    },
    {
        id: 'm8',
        content: 'Che ne dici di domani alle 15:00?',
        senderId: '1',
        timestamp: new Date('2024-11-18T09:30:00'),
        isRead: false,
        viewCount: 0,
    },
    {
        id: 'm9',
        content: 'Perfetto! Ci vediamo domani allora 😊',
        senderId: '2',
        timestamp: new Date('2024-11-18T09:35:00'),
        isRead: false,
        viewCount: 0,
    },
];

export const mockChats: Chat[] = [
    {
        id: 'c1',
        participants: [mockUsers[0], mockUsers[1]],
        messages: mockMessages,
        lastMessage: mockMessages[mockMessages.length - 1],
        unreadCount: 3,
        isPinned: true,
    },
    {
        id: 'c2',
        participants: [mockUsers[0], mockUsers[2]],
        messages: [
            {
                id: 'm10',
                content: 'Ciao, hai visto la presentazione?',
                senderId: '3',
                timestamp: new Date('2024-11-17T14:20:00'),
                isRead: true,
                viewCount: 1,
            },
        ],
        unreadCount: 0,
    },
    {
        id: 'c3',
        participants: [mockUsers[0], mockUsers[3]],
        messages: [
            {
                id: 'm11',
                content: 'Buongiorno! Ti serve aiuto con il codice?',
                senderId: '4',
                timestamp: new Date('2024-11-16T11:00:00'),
                isRead: true,
                viewCount: 2,
            },
        ],
        unreadCount: 1,
        isPinned: true,
    },
];

// Funzioni helper per formattare i dati
export const formatTimestamp = (date: Date): string => {
    const now = new Date();

    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Adesso';
    if (minutes < 60) return `${minutes}m fa`;
    if (hours < 24) return `${hours}h fa`;
    if (days < 7) return `${days}g fa`;

    return date.toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
};

export const getUserById = (userId: string): User | undefined => {
    return mockUsers.find(user => user.id === userId);
};

export const getChatById = (chatId: string): Chat | undefined => {
    return mockChats.find(chat => chat.id === chatId);
};
