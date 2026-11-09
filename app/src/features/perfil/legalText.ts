export interface LegalDoc {
  title: string;
  paragraphs: string[];
}

const DRAFT = 'RASCUNHO: texto provisório, sem validade jurídica. Será substituído pela versão revisada antes do lançamento.';

export const PRIVACY: LegalDoc = {
  title: 'Privacidade e dados (LGPD)',
  paragraphs: [
    DRAFT,
    'Usamos sua localização apenas para ordenar casas e eventos por distância. Você escolhe o ponto de partida: sua localização em tempo real ou um endereço cadastrado.',
    'Sua localização em tempo real fica somente neste aparelho. O endereço que você cadastra (CEP, rua, número e bairro) fica salvo na sua conta para calcular a distância a partir de casa, e você pode apagar quando quiser.',
    'Seus favoritos, filtros e preferências ficam salvos localmente. Nesta versão não há conta nem envio de dados pessoais.',
    'Você poderá pedir acesso, correção ou exclusão dos seus dados quando o login estiver disponível.',
  ],
};

export const TERMS: LegalDoc = {
  title: 'Termos de uso',
  paragraphs: [
    DRAFT,
    'O Qual a boa? é um guia de festas e casas noturnas de Vitória e região, destinado a maiores de 18 anos.',
    'As informações de eventos podem mudar sem aviso. Confirme horário, preço e lotação com a casa antes de sair.',
    'Durante o piloto, o app pode exibir conteúdo de demonstração até que as informações sejam verificadas com cada casa.',
    'Beba com moderação. Se beber, não dirija.',
  ],
};