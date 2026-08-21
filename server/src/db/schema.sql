PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  rol TEXT NOT NULL CHECK (rol IN ('qa', 'gestor')),
  avatar_url TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS proyectos (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  propietario_id TEXT NOT NULL REFERENCES usuarios(id),
  estado TEXT NOT NULL CHECK (estado IN ('activo', 'archivado')) DEFAULT 'activo',
  creado_en TEXT NOT NULL,
  actualizado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS etiquetas (
  id TEXT PRIMARY KEY,
  proyecto_id TEXT NOT NULL REFERENCES proyectos(id),
  nombre TEXT NOT NULL,
  color TEXT NOT NULL,
  UNIQUE (proyecto_id, nombre)
);

CREATE TABLE IF NOT EXISTS suites (
  id TEXT PRIMARY KEY,
  proyecto_id TEXT NOT NULL REFERENCES proyectos(id),
  suite_padre_id TEXT REFERENCES suites(id),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  creado_en TEXT NOT NULL,
  actualizado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS casos_prueba (
  id TEXT PRIMARY KEY,
  suite_id TEXT NOT NULL REFERENCES suites(id),
  titulo TEXT NOT NULL,
  descripcion TEXT,
  precondiciones TEXT,
  prioridad TEXT NOT NULL CHECK (prioridad IN ('alta', 'media', 'baja')),
  tipo TEXT NOT NULL CHECK (tipo IN ('funcional', 'regresion', 'humo', 'exploratorio')),
  estado TEXT NOT NULL CHECK (estado IN ('borrador', 'activo', 'obsoleto')) DEFAULT 'borrador',
  autor_id TEXT NOT NULL REFERENCES usuarios(id),
  creado_en TEXT NOT NULL,
  actualizado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS caso_etiquetas (
  caso_id TEXT NOT NULL REFERENCES casos_prueba(id),
  etiqueta_id TEXT NOT NULL REFERENCES etiquetas(id),
  PRIMARY KEY (caso_id, etiqueta_id)
);

CREATE TABLE IF NOT EXISTS pasos (
  id TEXT PRIMARY KEY,
  caso_id TEXT NOT NULL REFERENCES casos_prueba(id),
  orden INTEGER NOT NULL,
  accion TEXT NOT NULL,
  resultado_esperado TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ciclos (
  id TEXT PRIMARY KEY,
  proyecto_id TEXT NOT NULL REFERENCES proyectos(id),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  estado TEXT NOT NULL CHECK (estado IN ('planificada', 'en_progreso', 'bloqueada', 'completada')) DEFAULT 'planificada',
  fecha_inicio TEXT NOT NULL,
  fecha_fin_prevista TEXT NOT NULL,
  fecha_fin_real TEXT,
  responsable_id TEXT NOT NULL REFERENCES usuarios(id),
  creado_en TEXT NOT NULL,
  actualizado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ejecuciones (
  id TEXT PRIMARY KEY,
  ciclo_id TEXT NOT NULL REFERENCES ciclos(id),
  caso_id TEXT NOT NULL REFERENCES casos_prueba(id),
  ejecutor_id TEXT REFERENCES usuarios(id),
  estado TEXT NOT NULL CHECK (estado IN ('pendiente', 'en_progreso', 'passed', 'failed', 'blocked', 'skipped')) DEFAULT 'pendiente',
  fecha_ejecucion TEXT,
  duracion_segundos INTEGER,
  comentario TEXT,
  creado_en TEXT NOT NULL,
  actualizado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS resultados_paso (
  id TEXT PRIMARY KEY,
  ejecucion_id TEXT NOT NULL REFERENCES ejecuciones(id),
  paso_id TEXT NOT NULL REFERENCES pasos(id),
  estado TEXT NOT NULL CHECK (estado IN ('pass', 'fail', 'skip')),
  comentario TEXT
);

CREATE TABLE IF NOT EXISTS defectos (
  id TEXT PRIMARY KEY,
  proyecto_id TEXT NOT NULL REFERENCES proyectos(id),
  ejecucion_origen_id TEXT REFERENCES ejecuciones(id),
  titulo TEXT NOT NULL,
  descripcion TEXT,
  severidad TEXT NOT NULL CHECK (severidad IN ('critica', 'alta', 'media', 'baja')),
  estado TEXT NOT NULL CHECK (estado IN ('abierto', 'en_progreso', 'resuelto', 'cerrado', 'reabierto')) DEFAULT 'abierto',
  reportado_por_id TEXT NOT NULL REFERENCES usuarios(id),
  creado_en TEXT NOT NULL,
  actualizado_en TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_etiquetas_proyecto ON etiquetas(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_suites_proyecto ON suites(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_suites_padre ON suites(suite_padre_id);
CREATE INDEX IF NOT EXISTS idx_casos_suite ON casos_prueba(suite_id);
CREATE INDEX IF NOT EXISTS idx_pasos_caso ON pasos(caso_id);
CREATE INDEX IF NOT EXISTS idx_ciclos_proyecto ON ciclos(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_ejecuciones_ciclo ON ejecuciones(ciclo_id);
CREATE INDEX IF NOT EXISTS idx_ejecuciones_caso ON ejecuciones(caso_id);
CREATE INDEX IF NOT EXISTS idx_resultados_paso_ejecucion ON resultados_paso(ejecucion_id);
CREATE INDEX IF NOT EXISTS idx_defectos_proyecto ON defectos(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_defectos_ejecucion_origen ON defectos(ejecucion_origen_id);
