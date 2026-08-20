import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TotpEnrollForm } from '../components/TotpEnrollForm';

type Step = 'ask' | 'setup';

function TwoFactorSetupPage() {
    const [step, setStep] = useState<Step>('ask');
    const navigate = useNavigate();

    if (step === 'ask') {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="bg-gray-900 p-10 rounded-xl flex flex-col gap-4 max-w-sm text-center">
                    <h1 className="text-white text-2xl font-bold">Enable Two-Factor Authentication?</h1>
                    <p className="text-gray-400 text-sm">Add an extra layer of security to your account using an authenticator app.</p>
                    <div className="flex flex-col gap-3 mt-2">
                        <button
                            onClick={() => setStep('setup')}
                            className="border border-white text-white px-6 py-2 rounded hover:bg-white hover:text-black transition-colors">
                            Enable 2FA
                        </button>
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="text-gray-500 text-sm hover:text-white transition-colors">
                            Skip for now
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black flex items-center justify-center">
            <div className="bg-gray-900 p-10 rounded-xl flex flex-col gap-4 max-w-sm text-center">
                <h1 className="text-white text-2xl font-bold">Scan this QR code</h1>
                <TotpEnrollForm
                    hasPassword
                    onEnabled={() => navigate('/dashboard')}
                    onCancel={() => navigate('/dashboard')}
                />
            </div>
        </div>
    );
}

export default TwoFactorSetupPage;
