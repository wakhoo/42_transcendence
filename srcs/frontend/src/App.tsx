import { useState, useEffect } from 'react';

function App() {
  const [status, setStatus] = useState<string>('chargement...');

  useEffect(() => {
    fetch('/api/health')
      .then((response) => response.json())
      .then((data) => setStatus(data.status))
      .catch(() => setStatus('erreur : back injoignable'));
  }, []);

  return (
    <div>
      <h1>ft_transcendence</h1>
      <p>Statut du back : {status}</p>
    </div>
  );
}

export default App;
