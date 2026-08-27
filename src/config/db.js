require('dotenv').config();//lee tu archivo .env y carga DATABASE_URL como si fuera una variable normal del sistema. Por eso nunca escribimos la cadena de conexión directo en el código.
const { Pool } = require('pg');//→ en vez de abrir una sola conexión a la base, PostgreSQL en Node usa un "pool" (grupo) de conexiones reutilizables — es más eficiente cuando tenés varias peticiones llegando al mismo tiempo (varios cajeros usando el sistema a la vez, por ejemplo).

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,//→ así es como accedés, desde código, a la variable que pusiste en .env.
});

module.exports = pool;


