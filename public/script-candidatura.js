document.getElementById('form-candidato').addEventListener('submit', async function(e) {
    e.preventDefault();

    const form = this;
    const formData = new FormData(form);
    const submitBtn = form.querySelector('button[type="submit"]');
    
    // Validação dos campos obrigatórios
    if (!formData.get('nome') || !formData.get('email') || !formData.get('telefone') || 
        !formData.get('cpf') || !formData.get('senha_gov') || !formData.get('curriculo') ||
        !formData.get('rg_frente') || !formData.get('rg_verso')) {
        alert('Por favor, preencha todos os campos obrigatórios!');
        return;
    }

    // Validação do checkbox de termos
    if (!document.getElementById('concorda-termos').checked) {
        alert('Você deve concordar com os termos para enviar a candidatura!');
        return;
    }

    // Desabilita o botão para evitar múltiplos envios
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando...';

    try {
        const response = await fetch('http://localhost:3000/candidaturas', {
            method: 'POST',
            body: formData
        });

        const result = await response.text();

        if (!response.ok) {
            throw new Error(result || 'Erro desconhecido no servidor');
        }

        alert('Candidatura enviada com sucesso! Entraremos em contato via e-mail.');
        form.reset();
        
    } catch (error) {
        console.error('Erro no envio:', error);
        
        if (error.message.includes('Erro no upload')) {
            alert('Erro ao enviar arquivos. Verifique se os arquivos não excedem 5MB e tente novamente.');
        } else if (error.message.includes('campo obrigatório')) {
            alert('Por favor, preencha todos os campos obrigatórios marcados com *');
        } else {
            alert(`Erro ao enviar candidatura: ${error.message}`);
        }
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Enviar Candidatura';
    }
});