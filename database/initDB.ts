import { SQLiteDatabase } from "expo-sqlite";

export async function initializeDatabase(db: SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      cor TEXT NOT NULL,
      icone TEXT NOT NULL,
      tipo TEXT NOT NULL,
      ativa INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS contas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      saldo_inicial REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS transacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL,
      valor REAL NOT NULL,
      data_vencimento TEXT NOT NULL,
      status TEXT NOT NULL,
      descricao TEXT NOT NULL,
      categoria_id INTEGER,
      conta_id INTEGER NOT NULL,
      FOREIGN KEY (categoria_id) REFERENCES categorias (id),
      FOREIGN KEY (conta_id) REFERENCES contas (id)
    );

    CREATE TABLE IF NOT EXISTS metas (
      categoria_id INTEGER PRIMARY KEY,
      valor REAL
    );

    -- NOVA TABELA: CAIXINHAS DE OBJETIVOS
    CREATE TABLE IF NOT EXISTS caixinhas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      meta_valor REAL NOT NULL,
      saldo_atual REAL DEFAULT 0,
      cor TEXT NOT NULL,
      icone TEXT NOT NULL
    );
  `);

  const categoriasAtuais = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM categorias",
  );

  if (categoriasAtuais && categoriasAtuais.count === 0) {
    await db.execAsync(`
      INSERT INTO categorias (nome, cor, icone, tipo, ativa) VALUES 
      ('Alimentação', '#E76F51', 'restaurant', 'despesa', 1),
      ('Transporte', '#F4A261', 'directions-car', 'despesa', 1),
      ('Moradia', '#264653', 'home', 'despesa', 1),
      ('Lazer', '#E9C46A', 'sports-esports', 'despesa', 1),
      ('Saúde', '#2A9D8F', 'local-hospital', 'despesa', 1),
      ('Educação', '#457B9D', 'school', 'despesa', 1),
      ('Salário', '#8AB17D', 'attach-money', 'receita', 1),
      ('Rendimentos', '#2A9D8F', 'trending-up', 'receita', 1),
      ('Vendas', '#E9C46A', 'storefront', 'receita', 1);
    `);
  }

  // Sementes para as Caixinhas
  const caixinhasAtuais = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM caixinhas",
  );
  if (caixinhasAtuais && caixinhasAtuais.count === 0) {
    await db.execAsync(`
      INSERT INTO caixinhas (nome, meta_valor, saldo_atual, cor, icone) VALUES 
      ('Upgrade PC', 1500.00, 300.00, '#8A05BE', 'computer'),
      ('Filamento 3D', 150.00, 50.00, '#2A9D8F', 'print');
    `);
  }
}
