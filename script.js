/* ===== FIREBASE CONFIG ===== */

let db = null;

async function inicializarFirebase() {
    if (window.firebaseConfig) {
        db = window.firebaseConfig.database;
        console.log('✅ Firebase inicializado com sucesso!');
        carregarDadosDoFirebase();
    }
}

function salvarNoFirebase() {
    if (!db) {
        console.warn('Firebase não inicializado');
        salvarNoLocalStorage();
        return;
    }

    const { ref, set } = window.firebaseDB;
    
    try {
        set(ref(db, 'estoque/loja_v3'), estoque);
        set(ref(db, 'vendas/loja_v3'), vendas);
        set(ref(db, 'movimentacoes/loja_v3'), movimentacoes);
        console.log('✅ Dados salvos no Firebase');
    } catch (erro) {
        console.error('Erro ao salvar no Firebase:', erro);
        salvarNoLocalStorage();
    }
}

function carregarDadosDoFirebase() {
    if (!db) {
        carregarDoLocalStorage();
        return;
    }

    const { ref, get } = window.firebaseDB;

    Promise.all([
        get(ref(db, 'estoque/loja_v3')),
        get(ref(db, 'vendas/loja_v3')),
        get(ref(db, 'movimentacoes/loja_v3'))
    ]).then(snapshots => {
        if (snapshots[0].exists()) estoque = snapshots[0].val() || [];
        if (snapshots[1].exists()) vendas = snapshots[1].val() || [];
        if (snapshots[2].exists()) movimentacoes = snapshots[2].val() || [];
        
        console.log('✅ Dados carregados do Firebase');
        atualizarTudo();
    }).catch(erro => {
        console.error('Erro ao carregar do Firebase:', erro);
        carregarDoLocalStorage();
    });
}

function salvarNoLocalStorage() {
    localStorage.setItem('estoque_loja_v3', JSON.stringify(estoque));
    localStorage.setItem('vendas_loja_v3', JSON.stringify(vendas));
    localStorage.setItem('movimentacoes_loja_v3', JSON.stringify(movimentacoes));
}

function carregarDoLocalStorage() {
    estoque = JSON.parse(localStorage.getItem('estoque_loja_v3')) || [];
    vendas = JSON.parse(localStorage.getItem('vendas_loja_v3')) || [];
    movimentacoes = JSON.parse(localStorage.getItem('movimentacoes_loja_v3')) || [];
    atualizarTudo();
}

/* ===== SISTEMA DE LOGIN SEGURO ===== */

const USUARIO_CORRETO = 'vandalinda123';
const SENHA_CORRETA = 'vandalinda12';

function verificarLogin() {
    const usuarioLogado = localStorage.getItem('usuarioLogado');
    if (!usuarioLogado) {
        document.getElementById('loginPage').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
    } else {
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        inicializarFirebase();
        inicializarApp();
    }
}

function fazerLogin(e) {
    e.preventDefault();
    
    const usuario = document.getElementById('usuario').value.trim();
    const senha = document.getElementById('senha').value;
    const errorDiv = document.getElementById('loginError');
    
    if (usuario === USUARIO_CORRETO && senha === SENHA_CORRETA) {
        localStorage.setItem('usuarioLogado', usuario);
        errorDiv.classList.remove('show');
        document.getElementById('usuario').value = '';
        document.getElementById('senha').value = '';
        document.getElementById('senha').type = 'password';
        document.querySelector('.password-toggle').textContent = '👁️';
        verificarLogin();
    } else {
        errorDiv.textContent = 'Usuário ou senha incorretos!';
        errorDiv.classList.add('show');
        document.getElementById('senha').value = '';
        document.getElementById('usuario').focus();
    }
}

function fazerLogout() {
    if (confirm('Tem certeza que deseja sair?')) {
        localStorage.removeItem('usuarioLogado');
        document.getElementById('usuario').value = '';
        document.getElementById('senha').value = '';
        document.getElementById('senha').type = 'password';
        document.querySelector('.password-toggle').textContent = '👁️';
        verificarLogout();
    }
}

function verificarLogout() {
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
}

function togglePasswordVisibility() {
    const senhaInput = document.getElementById('senha');
    const toggleBtn = document.querySelector('.password-toggle');
    
    if (senhaInput.type === 'password') {
        senhaInput.type = 'text';
        toggleBtn.textContent = '🙈';
    } else {
        senhaInput.type = 'password';
        toggleBtn.textContent = '👁️';
    }
}

/* ===== SISTEMA DE ESTOQUE ===== */

let estoque = [];
let vendas = [];
let movimentacoes = [];
let produtoVendaAtual = null;
let produtoEdicaoAtual = null;
let metodoPagamentoSelecionado = null;
let produtoParaDeletar = null;
let coloresAdicionadas = [];
let imagemBase64 = null;

function inicializarApp() {
    const valorAqInput = document.getElementById('valorAquisicao');
    const percentualInput = document.getElementById('percentualLucro');
    const colorPickerInput = document.getElementById('colorPicker');
    const dataEntradaInput = document.getElementById('dataEntrada');
    const mesRelatorioInput = document.getElementById('mesRelatorio');

    if (valorAqInput) {
        valorAqInput.addEventListener('input', calcularValorVenda);
        valorAqInput.addEventListener('blur', function() {
            this.value = formatarPreco(desformatarPreco(this.value).toFixed(2));
        });
    }

    if (percentualInput) {
        percentualInput.addEventListener('input', calcularValorVenda);
    }

    if (colorPickerInput) {
        colorPickerInput.addEventListener('input', function() {
            const emojiElement = document.querySelector('.color-preview-emoji');
            if (emojiElement) {
                emojiElement.textContent = '🎨';
            }
        });
    }

    if (dataEntradaInput) {
        dataEntradaInput.valueAsDate = new Date();
    }

    if (mesRelatorioInput) {
        const hoje = new Date();
        const ano = hoje.getFullYear();
        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
        mesRelatorioInput.value = `${ano}-${mes}`;
    }

    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                fecharModal(this.id);
            }
        });
    });

    atualizarTudo();
}

function formatarPreco(valor) {
    return valor.toString().replace('.', ',');
}

function desformatarPreco(valor) {
    return parseFloat(valor.toString().replace(',', '.'));
}

function calcularValorVenda() {
    const valorAqInput = document.getElementById('valorAquisicao');
    const percentualInput = document.getElementById('percentualLucro');
    const resultElement = document.getElementById('valorVendaCalculado');

    if (!valorAqInput || !percentualInput || !resultElement) return;

    const valorAquisicao = desformatarPreco(valorAqInput.value) || 0;
    const percentualLucro = parseFloat(percentualInput.value) || 0;
    const valorVenda = valorAquisicao * (1 + percentualLucro / 100);
    resultElement.textContent = valorVenda.toFixed(2).replace('.', ',');
}

function toggleSize(e, gridId) {
    e.preventDefault();
    e.target.classList.toggle('selected');
}

function adicionarCor(e) {
    e.preventDefault();
    const nomeCor = document.getElementById('colorName').value.trim();
    const corHex = document.getElementById('colorPicker').value;

    if (!nomeCor) {
        mostrarAlerta('Por favor, digite o nome da cor!');
        return;
    }

    if (coloresAdicionadas.some(c => c.nome.toLowerCase() === nomeCor.toLowerCase())) {
        mostrarAlerta('Esta cor já foi adicionada!');
        return;
    }

    coloresAdicionadas.push({ nome: nomeCor, hex: corHex });
    atualizarListaCores();
    document.getElementById('colorName').value = '';
    document.getElementById('colorPicker').value = '#000000';
}

function removerCor(index) {
    coloresAdicionadas.splice(index, 1);
    atualizarListaCores();
}

function atualizarListaCores() {
    const colorsList = document.getElementById('colorsList');
    if (coloresAdicionadas.length === 0) {
        colorsList.innerHTML = '';
        return;
    }
    colorsList.innerHTML = coloresAdicionadas.map((cor, idx) => `
        <div class="color-tag">
            <div class="color-circle" style="background: ${cor.hex};"></div>
            <span class="color-name">${cor.nome}</span>
            <button type="button" class="color-remove" onclick="removerCor(${idx})" title="Remover cor">✕</button>
        </div>
    `).join('');
}

function previewImage(event) {
    const file = event.target.files[0];
    if (file) {
        if (file.size > 5 * 1024 * 1024) {
            mostrarAlerta('A imagem deve ter no máximo 5MB!');
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            imagemBase64 = e.target.result;
            const preview = document.getElementById('previewImg');
            const previewContainer = document.getElementById('previewContainer');
            const placeholderContent = document.getElementById('placeholderContent');
            const uploadContainer = document.getElementById('uploadContainer');
            
            if (preview && previewContainer && placeholderContent && uploadContainer) {
                preview.src = imagemBase64;
                previewContainer.style.display = 'block';
                placeholderContent.style.display = 'none';
                uploadContainer.classList.add('has-image');
            }
        };
        reader.readAsDataURL(file);
    }
}

function removerImagem(event) {
    event.preventDefault();
    imagemBase64 = null;
    
    const imagemProdutoInput = document.getElementById('imagemProduto');
    const previewImg = document.getElementById('previewImg');
    const previewContainer = document.getElementById('previewContainer');
    const placeholderContent = document.getElementById('placeholderContent');
    const uploadContainer = document.getElementById('uploadContainer');
    
    if (imagemProdutoInput) imagemProdutoInput.value = '';
    if (previewImg) previewImg.src = '';
    if (previewContainer) previewContainer.style.display = 'none';
    if (placeholderContent) placeholderContent.style.display = 'flex';
    if (uploadContainer) uploadContainer.classList.remove('has-image');
}

function getSelectedSizes(gridId) {
    const grid = document.getElementById(gridId);
    if (!grid) return [];
    
    const buttons = grid.querySelectorAll('.size-option');
    const sizes = [];
    buttons.forEach(btn => {
        if (btn.classList.contains('selected')) {
            sizes.push(btn.textContent);
        }
    });
    return sizes;
}

function adicionarProduto(e) {
    e.preventDefault();
    
    const tamanhos = getSelectedSizes('sizeGridAdd');

    if (tamanhos.length === 0) {
        mostrarAlerta('Por favor, selecione pelo menos um tamanho!');
        return;
    }

    if (coloresAdicionadas.length === 0) {
        mostrarAlerta('Por favor, adicione pelo menos uma cor!');
        return;
    }
    
    const nomeProdutoInput = document.getElementById('nomeProduto');
    const quantidadeInput = document.getElementById('quantidade');
    const valorAqInput = document.getElementById('valorAquisicao');
    const percentualInput = document.getElementById('percentualLucro');
    const dataEntradaInput = document.getElementById('dataEntrada');

    if (!nomeProdutoInput || !quantidadeInput || !valorAqInput || !percentualInput || !dataEntradaInput) {
        mostrarAlerta('Erro ao processar dados!');
        return;
    }

    const valorAq = desformatarPreco(valorAqInput.value);
    
    const produto = {
        id: Date.now(),
        nome: nomeProdutoInput.value,
        quantidade: parseInt(quantidadeInput.value),
        valorAquisicao: valorAq,
        percentualLucro: parseFloat(percentualInput.value),
        dataEntrada: dataEntradaInput.value,
        tamanhos: tamanhos,
        cores: coloresAdicionadas.slice(),
        imagem: imagemBase64,
        valorVenda: 0
    };

    produto.valorVenda = produto.valorAquisicao * (1 + produto.percentualLucro / 100);
    
    estoque.push(produto);
    movimentacoes.push({
        id: Date.now(),
        produtoNome: produto.nome,
        acao: 'Entrada',
        quantidade: produto.quantidade,
        data: new Date().toLocaleString('pt-BR'),
        usuario: 'Sistema'
    });
    
    salvarNoFirebase();
    salvarNoLocalStorage();
    
    const formProduto = document.getElementById('formProduto');
    if (formProduto) formProduto.reset();
    
    const valorVendaCalcElement = document.getElementById('valorVendaCalculado');
    if (valorVendaCalcElement) valorVendaCalcElement.textContent = '0,00';
    
    const previewContainer = document.getElementById('previewContainer');
    const placeholderContent = document.getElementById('placeholderContent');
    const uploadContainer = document.getElementById('uploadContainer');
    
    if (previewContainer) previewContainer.style.display = 'none';
    if (placeholderContent) placeholderContent.style.display = 'flex';
    if (uploadContainer) uploadContainer.classList.remove('has-image');
    
    coloresAdicionadas = [];
    imagemBase64 = null;
    atualizarListaCores();
    document.querySelectorAll('#sizeGridAdd .size-option').forEach(btn => btn.classList.remove('selected'));
    
    atualizarTudo();
    abrirTab('estoque');
}

function mostrarAlerta(mensagem) {
    const alertElement = document.getElementById('modalAlert');
    const alertMessage = document.getElementById('alertMessage');
    if (alertElement && alertMessage) {
        alertMessage.textContent = mensagem;
        alertElement.classList.add('active');
    }
}

function abrirModalDelete(id) {
    const produto = estoque.find(p => p.id === id);
    if (!produto) return;

    produtoParaDeletar = id;
    const deleteProductName = document.getElementById('deleteProductName');
    if (deleteProductName) {
        deleteProductName.textContent = produto.nome;
    }
    
    const modalDelete = document.getElementById('modalDelete');
    if (modalDelete) {
        modalDelete.classList.add('active');
    }
}

function confirmarDelete() {
    if (produtoParaDeletar) {
        const produto = estoque.find(p => p.id === produtoParaDeletar);
        estoque = estoque.filter(p => p.id !== produtoParaDeletar);
        movimentacoes.push({
            id: Date.now(),
            produtoNome: produto.nome,
            acao: 'Exclusão',
            quantidade: produto.quantidade,
            data: new Date().toLocaleString('pt-BR'),
            usuario: 'Sistema'
        });
        salvarNoFirebase();
        salvarNoLocalStorage();
        fecharModal('modalDelete');
        produtoParaDeletar = null;
        atualizarTudo();
    }
}

function abrirModalVenda(id) {
    const produto = estoque.find(p => p.id === id);
    if (!produto) return;

    produtoVendaAtual = produto;
    metodoPagamentoSelecionado = null;
    
    const modalProdutoNome = document.getElementById('modalProdutoNome');
    const modalQuantidade = document.getElementById('modalQuantidade');
    const modalDataSaida = document.getElementById('modalDataSaida');

    if (modalProdutoNome) modalProdutoNome.value = produto.nome;
    if (modalQuantidade) {
        modalQuantidade.value = 1;
        modalQuantidade.max = produto.quantidade;
    }
    if (modalDataSaida) modalDataSaida.valueAsDate = new Date();
    
    const sizeSelect = document.getElementById('modalTamanho');
    if (sizeSelect) {
        sizeSelect.innerHTML = '<option value="">Selecione um tamanho</option>';
        produto.tamanhos.forEach(tamanho => {
            const option = document.createElement('option');
            option.value = tamanho;
            option.textContent = tamanho;
            sizeSelect.appendChild(option);
        });
    }

    const colorSelect = document.getElementById('modalCor');
    if (colorSelect) {
        colorSelect.innerHTML = '<option value="">Selecione uma cor</option>';
        produto.cores.forEach((cor, idx) => {
            const option = document.createElement('option');
            option.value = idx;
            option.textContent = cor.nome;
            colorSelect.appendChild(option);
        });
    }
    
    document.querySelectorAll('.payment-option').forEach(el => {
        el.classList.remove('selected');
    });
    
    const modalVenda = document.getElementById('modalVenda');
    if (modalVenda) {
        modalVenda.classList.add('active');
    }
}

function abrirModalEditar(id) {
    const produto = estoque.find(p => p.id === id);
    if (!produto) return;

    produtoEdicaoAtual = produto;
    
    const editNomeProduto = document.getElementById('editNomeProduto');
    const editQuantidade = document.getElementById('editQuantidade');
    const editValorAquisicao = document.getElementById('editValorAquisicao');
    const editPercentualLucro = document.getElementById('editPercentualLucro');

    if (editNomeProduto) editNomeProduto.value = produto.nome;
    if (editQuantidade) editQuantidade.value = produto.quantidade;
    if (editValorAquisicao) editValorAquisicao.value = formatarPreco(produto.valorAquisicao.toFixed(2));
    if (editPercentualLucro) editPercentualLucro.value = produto.percentualLucro;
    
    const modalEditar = document.getElementById('modalEditar');
    if (modalEditar) {
        modalEditar.classList.add('active');
    }
}

function confirmarEdicao(e) {
    e.preventDefault();
    
    if (!produtoEdicaoAtual) return;
    
    const editQuantidade = document.getElementById('editQuantidade');
    const editValorAquisicao = document.getElementById('editValorAquisicao');
    const editPercentualLucro = document.getElementById('editPercentualLucro');
    const editNomeProduto = document.getElementById('editNomeProduto');

    if (!editQuantidade || !editValorAquisicao || !editPercentualLucro || !editNomeProduto) return;

    const novaQuantidade = parseInt(editQuantidade.value);
    const diferenca = novaQuantidade - produtoEdicaoAtual.quantidade;
    const novoValor = desformatarPreco(editValorAquisicao.value);
    
    produtoEdicaoAtual.nome = editNomeProduto.value;
    produtoEdicaoAtual.quantidade = novaQuantidade;
    produtoEdicaoAtual.valorAquisicao = novoValor;
    produtoEdicaoAtual.percentualLucro = parseFloat(editPercentualLucro.value);
    produtoEdicaoAtual.valorVenda = produtoEdicaoAtual.valorAquisicao * (1 + produtoEdicaoAtual.percentualLucro / 100);
    
    movimentacoes.push({
        id: Date.now(),
        produtoNome: produtoEdicaoAtual.nome,
        acao: 'Edição',
        quantidade: diferenca !== 0 ? `Quantidade: ${diferenca > 0 ? '+' : ''}${diferenca}` : 'Dados alterados',
        data: new Date().toLocaleString('pt-BR'),
        usuario: 'Sistema'
    });
    
    salvarNoFirebase();
    salvarNoLocalStorage();
    
    fecharModal('modalEditar');
    produtoEdicaoAtual = null;
    atualizarTudo();
}

function fecharModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
    
    if (modalId === 'modalVenda') {
        produtoVendaAtual = null;
        metodoPagamentoSelecionado = null;
        const formVenda = document.getElementById('formVenda');
        if (formVenda) formVenda.reset();
    }
}

function selecionarPagamento(metodo, elemento) {
    metodoPagamentoSelecionado = metodo;
    document.querySelectorAll('.payment-option').forEach(el => {
        el.classList.remove('selected');
    });
    elemento.classList.add('selected');
}

function confirmarVenda(e) {
    e.preventDefault();
    
    if (!metodoPagamentoSelecionado) {
        mostrarAlerta('Por favor, selecione um método de pagamento antes de confirmar a venda.');
        return;
    }

    const modalTamanho = document.getElementById('modalTamanho');
    const modalCor = document.getElementById('modalCor');
    const modalQuantidade = document.getElementById('modalQuantidade');
    const modalDataSaida = document.getElementById('modalDataSaida');

    if (!modalTamanho || !modalCor || !modalQuantidade || !modalDataSaida) return;

    const tamanho = modalTamanho.value;
    const corIdx = modalCor.value;
    const quantidade = parseInt(modalQuantidade.value);
    const dataSaida = modalDataSaida.value;
    
    if (!tamanho || corIdx === '') {
        mostrarAlerta('Por favor, selecione o tamanho e a cor!');
        return;
    }

    if (quantidade > produtoVendaAtual.quantidade) {
        mostrarAlerta('Quantidade insuficiente em estoque! Disponível: ' + produtoVendaAtual.quantidade + ' unidades.');
        return;
    }
    
    const corSelecionada = produtoVendaAtual.cores[corIdx];
    
    const venda = {
        id: Date.now(),
        produtoNome: produtoVendaAtual.nome,
        tamanho: tamanho,
        cor: corSelecionada.nome,
        quantidade: quantidade,
        valorUnitario: produtoVendaAtual.valorVenda,
        valorTotal: produtoVendaAtual.valorVenda * quantidade,
        dataSaida: dataSaida,
        metodoPagamento: metodoPagamentoSelecionado
    };
    
    vendas.push(venda);
    produtoVendaAtual.quantidade -= quantidade;
    
    movimentacoes.push({
        id: Date.now(),
        produtoNome: produtoVendaAtual.nome,
        acao: 'Saída',
        quantidade: quantidade,
        data: new Date().toLocaleString('pt-BR'),
        usuario: 'Sistema'
    });
    
    salvarNoFirebase();
    salvarNoLocalStorage();
    
    fecharModal('modalVenda');
    atualizarTudo();
}

function filtrarEstoque() {
    const busca = document.getElementById('searchEstoque').value.toLowerCase();
    const cards = document.querySelectorAll('.produto-card');
    
    cards.forEach(card => {
        const nome = card.querySelector('.produto-nome').textContent.toLowerCase();
        if (nome.includes(busca)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

function filtrarVendas() {
    const busca = document.getElementById('searchVendas').value.toLowerCase();
    const rows = document.querySelectorAll('.vendas-table tbody tr');
    
    rows.forEach(row => {
        if (row.cells.length > 0) {
            const nome = row.cells[0].textContent.toLowerCase();
            if (nome.includes(busca)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        }
    });
}

function filtrarHistorico() {
    const busca = document.getElementById('searchHistorico').value.toLowerCase();
    const rows = document.querySelectorAll('.historico-table tbody tr');
    
    rows.forEach(row => {
        const conteudo = row.textContent.toLowerCase();
        if (conteudo.includes(busca)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

function atualizarEstoque() {
    const container = document.getElementById('estoqueContainer');
    if (!container) return;
    
    if (estoque.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">👔</div>
                <p>Nenhuma peça cadastrada ainda</p>
            </div>
        `;
        return;
    }

    container.innerHTML = '<div class="estoque-grid"></div>';
    const grid = container.querySelector('.estoque-grid');
    
    estoque.forEach(produto => {
        const card = document.createElement('div');
        card.className = `produto-card ${produto.quantidade === 0 ? 'sem-estoque' : ''}`;
        
        const coresHtml = produto.cores.map(cor => 
            `<div class="cor-badge"><div class="cor-circle-small" style="background: ${cor.hex};"></div>${cor.nome}</div>`
        ).join('');

        const tamanhosHtml = produto.tamanhos.map(tam => `<div class="tamanho-item">${tam}</div>`).join('');
        
        const imagemHtml = produto.imagem ? `<img src="${produto.imagem}" alt="${produto.nome}">` : '👕';
        
        card.innerHTML = `
            <div class="produto-nome">${produto.nome}</div>
            ${produto.quantidade === 0 ? '<div class="badge-sem-estoque">SEM ESTOQUE</div>' : ''}
            
            <div class="produto-image">${imagemHtml}</div>

            <div class="produto-tamanhos">
                <div class="tamanho-titulo">Tamanhos</div>
                <div class="tamanho-grid">${tamanhosHtml}</div>
            </div>

            <div class="produto-cores">
                <div class="cores-titulo">Cores</div>
                <div class="cores-grid">${coresHtml}</div>
            </div>

            <div class="produto-info">
                <span class="info-label">Quantidade:</span>
                <span class="info-value">${produto.quantidade} un</span>
                
                <span class="info-label">Custo:</span>
                <span class="info-value">R$ ${produto.valorAquisicao.toFixed(2).replace('.', ',')}</span>
                
                <span class="info-label">Margem:</span>
                <span class="info-value">${produto.percentualLucro.toFixed(2)}%</span>
                
                <span class="info-label">Venda:</span>
                <span class="info-value">R$ ${produto.valorVenda.toFixed(2).replace('.', ',')}</span>
            </div>
            
            <div class="produto-actions">
                <button class="btn-vender" onclick="abrirModalVenda(${produto.id})" ${produto.quantidade === 0 ? 'disabled' : ''}>
                    Vender
                </button>
                <button class="btn-editar" onclick="abrirModalEditar(${produto.id})">
                    Editar
                </button>
                <button class="btn-remover" onclick="abrirModalDelete(${produto.id})">
                    Remover
                </button>
            </div>
        `;
        
        grid.appendChild(card);
    });
}

function atualizarVendas() {
    const container = document.getElementById('vendasContainer');
    if (!container) return;
    
    if (vendas.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📊</div>
                <p>Nenhuma venda registrada ainda</p>
            </div>
        `;
        return;
    }

    const vendasOrdenadas = [...vendas].sort((a, b) => new Date(b.dataSaida) - new Date(a.dataSaida));

    container.innerHTML = `
        <table class="vendas-table">
            <thead>
                <tr>
                    <th>Peça</th>
                    <th>Tamanho</th>
                    <th>Cor</th>
                    <th>Qtde</th>
                    <th>Valor Unit.</th>
                    <th>Total</th>
                    <th>Pagamento</th>
                    <th>Data</th>
                </tr>
            </thead>
            <tbody>
                ${vendasOrdenadas.map(venda => `
                    <tr>
                        <td><strong>${venda.produtoNome}</strong></td>
                        <td>${venda.tamanho}</td>
                        <td>${venda.cor}</td>
                        <td>${venda.quantidade}</td>
                        <td>R$ ${venda.valorUnitario.toFixed(2).replace('.', ',')}</td>
                        <td><strong>R$ ${venda.valorTotal.toFixed(2).replace('.', ',')}</strong></td>
                        <td><span class="badge-payment">${venda.metodoPagamento}</span></td>
                        <td>${new Date(venda.dataSaida).toLocaleDateString('pt-BR')}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function atualizarRelatorios() {
    const container = document.getElementById('relatoriosContainer');
    if (!container) return;
    
    const mesInput = document.getElementById('mesRelatorio');
    const mesAtual = mesInput ? mesInput.value : obterMesAtual();
    
    const vendasMes = vendas.filter(v => {
        const mesVenda = v.dataSaida.substring(0, 7);
        return mesVenda === mesAtual;
    });

    if (vendasMes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📊</div>
                <p>Nenhuma venda registrada para ${new Date(mesAtual + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}</p>
            </div>
        `;
        return;
    }

    const produtosVendidos = {};
    let totalQuantidadeVendas = 0;
    
    vendasMes.forEach(v => {
        produtosVendidos[v.produtoNome] = (produtosVendidos[v.produtoNome] || 0) + v.quantidade;
        totalQuantidadeVendas += v.quantidade;
    });
    
    const topProdutos = Object.entries(produtosVendidos)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    let html = `<div class="chart-container">
        <div class="chart-title">📅 Relatório de ${new Date(mesAtual + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}</div>
        <div class="chart-title" style="font-size: 1.2em; margin-bottom: 20px; font-weight: 600;">🏆 Top 5 - Peças Mais Vendidas</div>`;
    
    if (topProdutos.length === 0) {
        html += '<p style="color: var(--text-gray);">Nenhuma venda registrada</p>';
    } else {
        const maxVendas = Math.max(...topProdutos.map(p => p[1]));
        html += '<div class="chart-bars">';
        topProdutos.forEach(([nome, qtd]) => {
            const percentual = (qtd / maxVendas) * 100;
            const percentualDoTotal = ((qtd / totalQuantidadeVendas) * 100).toFixed(1);
            html += `
                <div class="chart-bar" style="height: ${percentual}%;" title="${qtd} unidades (${percentualDoTotal}% do total)">
                    <div class="chart-bar-value">${qtd}</div>
                    <div class="chart-bar-label">${nome.substring(0, 15)}</div>
                </div>
            `;
        });
        html += '</div></div>';
    }

    const totalVendas = vendasMes.reduce((sum, v) => sum + v.valorTotal, 0);
    const totalCusto = vendasMes.reduce((sum, v) => {
        const produto = estoque.find(e => e.nome === v.produtoNome);
        return sum + (v.quantidade * (v.valorUnitario / (1 + (produto?.percentualLucro || 0) / 100)));
    }, 0);
    const lucroTotal = totalVendas - totalCusto;
    const lucroPercentual = totalCusto > 0 ? ((lucroTotal / totalCusto) * 100).toFixed(2) : 0;

    const metodoPagamento = {};
    vendasMes.forEach(v => {
        metodoPagamento[v.metodoPagamento] = (metodoPagamento[v.metodoPagamento] || 0) + v.valorTotal;
    });

    html += `
        <div class="chart-container">
            <div class="chart-title">💰 Análise Financeira - ${new Date(mesAtual + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}</div>
            <div class="dashboard">
                <div class="dashboard-card">
                    <h3>Faturamento</h3>
                    <div class="value">R$ ${totalVendas.toFixed(2).replace('.', ',')}</div>
                </div>
                <div class="dashboard-card">
                    <h3>Custo Total</h3>
                    <div class="value">R$ ${totalCusto.toFixed(2).replace('.', ',')}</div>
                </div>
                <div class="dashboard-card">
                    <h3>Lucro Líquido</h3>
                    <div class="value">R$ ${lucroTotal.toFixed(2).replace('.', ',')}</div>
                </div>
                <div class="dashboard-card">
                    <h3>Margem de Lucro</h3>
                    <div class="value">${lucroPercentual}%</div>
                </div>
            </div>
        </div>

        <div class="chart-container">
            <div class="chart-title">💳 Métodos de Pagamento</div>
            <table class="vendas-table" style="margin-top: 0;">
                <thead>
                    <tr>
                        <th>Método</th>
                        <th>Total Recebido</th>
                        <th>% do Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(metodoPagamento).map(([metodo, valor]) => {
                        const percentualMetodo = ((valor / totalVendas) * 100).toFixed(1);
                        return `
                            <tr>
                                <td><strong>${metodo}</strong></td>
                                <td>R$ ${valor.toFixed(2).replace('.', ',')}</td>
                                <td>${percentualMetodo}%</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>

        <div class="chart-container">
            <div class="chart-title">📈 Resumo do Mês</div>
            <table class="vendas-table" style="margin-top: 0;">
                <tbody>
                    <tr>
                        <td style="font-weight: 700;">Total de Vendas Realizadas</td>
                        <td style="text-align: right; font-weight: 700;">${vendasMes.length} venda(s)</td>
                    </tr>
                    <tr>
                        <td style="font-weight: 700;">Quantidade Total de Itens Vendidos</td>
                        <td style="text-align: right; font-weight: 700;">${totalQuantidadeVendas} un</td>
                    </tr>
                    <tr>
                        <td style="font-weight: 700;">Ticket Médio</td>
                        <td style="text-align: right; font-weight: 700;">R$ ${(totalVendas / vendasMes.length).toFixed(2).replace('.', ',')}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: 700;">Produto Mais Vendido</td>
                        <td style="text-align: right; font-weight: 700;">${topProdutos.length > 0 ? topProdutos[0][0] : 'N/A'}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;

    container.innerHTML = html;
}

function obterMesAtual() {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
}

function atualizarHistorico() {
    const container = document.getElementById('historicoContainer');
    if (!container) return;
    
    if (movimentacoes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <p>Nenhuma movimentação registrada ainda</p>
            </div>
        `;
        return;
    }

    const movOrdenadas = [...movimentacoes].sort((a, b) => new Date(b.data) - new Date(a.data));

    container.innerHTML = `
        <table class="historico-table">
            <thead>
                <tr>
                    <th>Peça</th>
                    <th>Ação</th>
                    <th>Quantidade</th>
                    <th>Data/Hora</th>
                </tr>
            </thead>
            <tbody>
                ${movOrdenadas.map(mov => {
                    let classeAcao = '';
                    if (mov.acao === 'Entrada') classeAcao = 'entrada';
                    else if (mov.acao === 'Saída') classeAcao = 'saida';
                    else classeAcao = 'edicao';
                    
                    return `
                        <tr>
                            <td><strong>${mov.produtoNome}</strong></td>
                            <td><span class="badge-acao ${classeAcao}">${mov.acao}</span></td>
                            <td>${typeof mov.quantidade === 'number' ? mov.quantidade + ' un' : mov.quantidade}</td>
                            <td>${mov.data}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

function atualizarDashboard() {
    const totalInvestido = estoque.reduce((sum, p) => sum + (p.valorAquisicao * p.quantidade), 0);
    const totalItens = estoque.reduce((sum, p) => sum + p.quantidade, 0);
    const totalVendidos = vendas.reduce((sum, v) => sum + v.quantidade, 0);
    const valorVendas = vendas.reduce((sum, v) => sum + v.valorTotal, 0);
    
    const totalInvestidoElement = document.getElementById('totalInvestido');
    const totalItensElement = document.getElementById('totalItens');
    const totalVendidosElement = document.getElementById('totalVendidos');
    const valorVendasElement = document.getElementById('valorVendas');

    if (totalInvestidoElement) totalInvestidoElement.textContent = `R$ ${totalInvestido.toFixed(2).replace('.', ',')}`;
    if (totalItensElement) totalItensElement.textContent = totalItens;
    if (totalVendidosElement) totalVendidosElement.textContent = totalVendidos;
    if (valorVendasElement) valorVendasElement.textContent = `R$ ${valorVendas.toFixed(2).replace('.', ',')}`;
}

function atualizarTudo() {
    atualizarEstoque();
    atualizarVendas();
    atualizarRelatorios();
    atualizarHistorico();
    atualizarDashboard();
}

function abrirTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    if (event && event.target) {
        event.target.classList.add('active');
    }
    const tabElement = document.getElementById('tab-' + tabName);
    if (tabElement) {
        tabElement.classList.add('active');
    }
}

verificarLogin();
