# 🎨 Melhorias de UI e UX - Comparador de Embalagens Técnicas

Este documento reúne sugestões detalhadas para elevar a Qualidade Visual (UI) e a Usabilidade (UX) do seu aplicativo de inspeção e comparação técnica de PDFs (FoxBox). 

As melhorias são baseadas na análise dos componentes principais (`PackagingViewer`, `PdfDiffViewer`, e `CmykViewer`).

---

## 1. Layout e Disposição de Ferramentas (UX/UI)

### 1.1. Barra de Ferramentas Vertical (Toolbar lateral)
**Problema:** Atualmente, todas as ferramentas principais (Mãozinha, Medição, Anotações, Comparar, CMYK) ficam em uma "pílula" no cabeçalho. Com a adição de novas funções no futuro, o cabeçalho ficará sobrecarregado.
**Solução:** Mover as ferramentas de interação com a prancheta para uma **barra lateral esquerda flutuante** (estilo Figma, Adobe Acrobat ou Illustrator). Isso libera espaço horizontal no cabeçalho e torna a troca de ferramentas mais ergonômica.

### 1.2. Painel Lateral de Anotações (Drawer)
**Problema:** O botão de anotações mostra um badge com a quantidade (ex: `[3]`), mas o usuário precisa encontrar os "pins" espalhados na prancheta.
**Solução:** Criar uma gaveta retrátil (Drawer) no lado direito da tela que liste todas as anotações. 
- **Benefício:** Clicar em um item da lista faria a câmera dar um pan/zoom suave (fly-to) diretamente até o ponto da anotação na prancheta.

### 1.3. Responsividade dos Controles Avançados
**Problema:** No `PdfDiffViewer`, a barra flutuante com controles de escala, opacidade e offset pode quebrar ou sobrepor elementos em telas menores (notebooks de 13").
**Solução:** Agrupar opções de calibração fina (Offset X/Y, auto-proporção) dentro de um botão de "Ajustes Avançados" que abra um popover/dropdown compacto, em vez de exibir todos inline.

---

## 2. Experiência de Comparação Visual (PdfDiffViewer)

### 2.1. Modo Cortina (Wipe) Aprimorado
**Melhoria:** Embora o controle deslizante seja funcional, em níveis altos de zoom os usuários podem perder o contexto de qual lado é a Versão A ou B.
**Solução UX:** 
- Adicionar uma **linha divisória mais espessa** com um "puxador" (handle) centralizador.
- Implementar "Labels adesivas" semi-transparentes que flutuam ao lado da linha divisória indicando qual versão está daquele lado.

### 2.2. Ajuste de Deslocamento (Offset) por Arrastar
**Melhoria:** Para ajustar milimetricamente o offset (encaixe da versão B), o usuário precisa usar as pequenas setas do teclado virtual ou digitar os pixels.
**Solução UX:** Permitir a **manipulação direta**. O usuário poderia segurar uma tecla modificadora (ex: `Shift`) e arrastar com o mouse diretamente na imagem para mover a Versão B sobre a Versão A em tempo real.

---

## 3. Visualizador CMYK e Performance (CmykViewer)

### 3.1. Feedback de Carregamento Progressivo (Skeleton / Loading)
**Problema:** A conversão pixel a pixel e extração das chapas CMYK usando `Float32Array` pode demorar um segundo em imagens muito pesadas. O loading atual exibe um texto no centro, o que pode parecer um "travamento".
**Solução UX:** Exibir um **Skeleton Loader** brilhante (shimmer effect) mantendo as silhuetas da embalagem ou uma **barra de progresso real** discreta no topo do canvas, indicando que a CPU está trabalhando na separação das cores.

### 3.2. Lupa de Inspeção de Retícula (Halftone Preview)
**Melhoria:** Gráficos avaliam as chapas (K, C, M, Y) focando na retícula.
**Solução UI:** Adicionar uma ferramenta de **Lupa** (Magnifier Glass) que siga o cursor do mouse e exiba um zoom ultra-ampliado (500% a 1000%) da área, facilitando a visualização dos pontos da chapa sem precisar dar zoom em toda a prancheta.

---

## 4. Micro-interações, Acessibilidade e Teclado

### 4.1. Dicas de Ferramenta (Tooltips) Inteligentes e Atalhos
**Melhoria:** A interface já possui atalhos ótimos (Espaço para Pan, Ctrl+Scroll). 
**Solução UX:** 
- Adicionar atalhos de teclado (ex: `V` para Seleção/Mão, `M` para Medição, `C` para Anotação, `D` para Diff).
- Nas tooltips dos botões, exibir explicitamente a tecla de atalho.
- Ter um modal de "Atalhos do Sistema" acessível pelo atalho `Shift + ?`.

### 4.2. Áreas Clicáveis Maiores (Hit Targets)
**Melhoria:** Botões de incremento e decremento (como os de offset e escala `[+]` `[-]`) estão visualmente muito atraentes, mas possuem área clicável um pouco restrita.
**Solução UI:** Aumentar o `padding` invisível ou o tamanho mínimo dos botões para pelo menos `32x32px`, seguindo diretrizes modernas de touch e acessibilidade.

---

## 5. Estética e UI Premium (FoxBox Identity)

- **Transições Suaves:** Adicionar `transition-all duration-300 ease-out` ao trocar os modos de visualização (ex: Fade-in ao ligar/desligar chapas CMYK).
- **Dark Mode (Modo Escuro):** Como a aplicação lida com mesas de luz, um Modo Escuro (Fundo cinza-chumbo ou preto absoluto) faria o contraste com o papel branco da embalagem "saltar" aos olhos, reduzindo o cansaço visual em longas horas de uso.
- **Glassmorphism Funcional:** Os painéis flutuantes no topo (como as calibrações) já usam `backdrop-blur`, mas aprofundar esse efeito com bordas translúcidas reforçará o aspecto de "Software Premium de Engenharia".
