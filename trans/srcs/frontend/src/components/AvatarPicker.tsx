import { useState } from 'react';
import { AVATARS } from './avatar';

type AvatarPickerProps = {
	currentAvatar: string | null;
	profileColor: string;
	onSelect: (avatarUrl: string) => void;
};

export function AvatarPicker({ currentAvatar, profileColor, onSelect }: AvatarPickerProps) {
	const [isOpen, setIsOpen] = useState(false);

	function handlePick(avatarUrl: string) {
		onSelect(avatarUrl);
		setIsOpen(false);
	}

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="w-10 h-10 rounded-lg shrink-0 overflow-hidden border-2 border-transparent hover:border-white transition-colors"
                style={{ backgroundColor: profileColor }}
            >
                {currentAvatar && (
                    <img src={currentAvatar} alt="avatar" className="w-full h-full object-cover" />
                )}
            </button>

            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center"
                    onClick={() => setIsOpen(false)}
                >
					<div
						className="bg-gray-900 rounded-xl border border-gray-800 p-4 max-w-lg w-full mx-4"
						onClick={e => e.stopPropagation()}
					>
						<h3 className="text-white text-sm font-semibold mb-3">Choisir un avatar</h3>
						<div className="grid grid-cols-4 gap-4">
							{AVATARS.map(avatarUrl => (
								<img
									key={avatarUrl}
									src={avatarUrl}
									onClick={() => handlePick(avatarUrl)}
									className={`w-24 h-24 rounded-lg cursor-pointer object-cover border-2 transition-all hover:scale-105 ${
										avatarUrl === currentAvatar ? 'border-white' : 'border-transparent hover:border-gray-600'
									}`}
								/>
							))}
						</div>
					</div>
                </div>
            )}
        </>
    );
}