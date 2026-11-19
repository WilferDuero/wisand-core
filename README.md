# 🚀 WISAND Core — Sistema de Gestión Comercial

**WISAND** es un proyecto de desarrollo de software orientado a la gestión de operaciones comerciales mediante una arquitectura multiempresa (*multi-tenant*).

Integra un backend con API REST, un punto de venta (POS) para computadores y una aplicación móvil administrativa.

El proyecto fue desarrollado como una solución funcional de aprendizaje y práctica, con el objetivo de integrar diferentes tecnologías y resolver necesidades de gestión comercial.

## 📌 Estado del proyecto

**Estado: prototipo funcional desarrollado y probado, sin implementación comercial.**

WISAND fue desarrollado y presentado durante mi etapa de formación técnica en Programación de Software.

El sistema cuenta con componentes para la administración comercial, acceso de usuarios y separación de información por empresa.

Se realizaron pruebas durante el desarrollo, pero el proyecto no fue implementado como sistema operativo de un negocio.

La existencia de componentes, pruebas automatizadas y documentación de despliegue no implica que todas las funcionalidades hayan sido verificadas en producción.

---

## ✨ Características principales

### ⚙️ Backend y API REST

- Gestión de usuarios y autenticación.
- Administración de productos.
- Gestión de pedidos.
- Registro de ventas.
- Gestión de reseñas.
- Control de acceso mediante roles.
- Separación de información por empresa.
- Soporte para PostgreSQL y SQLite.

### 💻 Punto de venta (POS)

Interfaz web orientada al uso desde computadores para gestionar operaciones comerciales.

Ubicación: `apps/pos-web/`

### 📱 Aplicación móvil administrativa

Aplicación desarrollada con React Native, Expo y TypeScript.

Orientada a la administración de operaciones comerciales mediante dispositivos móviles.

Ubicación: `apps/admin-mobile/`

### 🏢 Arquitectura multiempresa

El proyecto incluye una arquitectura diseñada para separar la información de diferentes negocios.

Entre sus componentes se encuentran:

- Tabla `tenants` para representar empresas.
- Identificación de empresa mediante `tenant_id`.
- Autenticación con código de empresa.
- Incorporación de `tenant_id` en los tokens JWT.
- Consultas de datos asociadas a cada empresa.
- Asociación de pedidos y ventas a su respectiva empresa.

---

## 🛠️ Tecnologías utilizadas

| Área | Tecnologías |
|---|---|
| Backend | Node.js, Express, JavaScript |
| Bases de datos | PostgreSQL, SQLite |
| Autenticación | JWT, bcryptjs |
| Aplicación móvil | React Native, Expo SDK 54 |
| Lenguaje móvil | TypeScript |
| Estado móvil | Zustand |
| Punto de venta | HTML, CSS, JavaScript |
| Acceso a datos | SQL mediante consultas directas |
| Control de versiones | Git y GitHub |

---

## 🏗️ Arquitectura

WISAND está organizado en tres componentes:

**1. Backend:** proporciona la API y gestiona las operaciones, usuarios y acceso a datos.

**2. POS web:** ofrece una interfaz de escritorio para realizar operaciones comerciales desde el navegador.

**3. Aplicación móvil:** proporciona una interfaz administrativa para dispositivos móviles.

Los componentes se encuentran organizados dentro de un mismo repositorio.

---

## 📂 Estructura del proyecto

```text
wisand-core/
│
├── apps/
│   ├── admin-mobile/
│   └── pos-web/
│
├── server/
│
├── docs/
│
├── render.yaml
│
└── README.md
```

### Componentes principales

- `server/`: API y lógica del backend.
- `apps/admin-mobile/`: aplicación móvil administrativa.
- `apps/pos-web/`: punto de venta para PC.
- `docs/`: documentación técnica y operativa.

---

## 💻 Instalación local

### 1. Backend

```bash
npm --prefix server install
npm --prefix server run migrate
npm --prefix server run dev
```

### 2. Aplicación móvil

```bash
npm --prefix apps/admin-mobile install
npm --prefix apps/admin-mobile run typecheck
npm --prefix apps/admin-mobile run start
```

### 3. Punto de venta

```bash
npm --prefix apps/pos-web install
npm --prefix apps/pos-web run start
```

Dirección local configurada para el POS:

`http://localhost:3030`

**Nota:** el funcionamiento requiere configurar correctamente las dependencias, las variables de entorno y la base de datos correspondiente.

---

## 🔐 Acceso administrativo

El proyecto incluye un comando para crear o actualizar el usuario propietario del sistema:

```bash
npm --prefix server run owner:create -- --username "tu_usuario" --password "TuClaveSegura"
```

La documentación del repositorio utiliza `wisand` como código de empresa para el acceso administrativo interno.

No deben publicarse credenciales reales ni claves privadas.

---

## 🗄️ Bases de datos

La arquitectura contempla el uso de PostgreSQL y SQLite.

El acceso a datos utiliza consultas SQL directas mediante métodos como:

- `db.get`
- `db.all`
- `db.run`

La estructura multiempresa utiliza `tenant_id` para relacionar los registros comerciales con sus respectivas empresas.

---

## 🧪 Pruebas y documentación

El proyecto incluye documentación relacionada con migraciones, pruebas y operaciones de despliegue.

**Documentos técnicos:**

- `docs/MIGRATIONS.md`
- `server/TESTING.md`

**Comando de pruebas multiempresa:**

```bash
npm --prefix server run test:multitenant
```

**Documentación operativa:**

- `docs/GO_LIVE_CHECKLIST.md`
- `docs/DIA_REAL_CHECKLIST.md`
- `docs/ENTREGA_PRIMER_CLIENTE.md`
- `docs/ENTREGA_CREDENCIALES_SOPORTE_7DIAS.md`
- `docs/REMOTE_BACKEND.md`
- `docs/RELEASE_FREEZE_V0_1.md`

**Comandos operativos definidos en el proyecto:**

```bash
npm --prefix server run ops:first-client
npm --prefix server run backup:db
```

Estos documentos y comandos forman parte de la preparación técnica del proyecto. No representan evidencia de que WISAND haya sido desplegado comercialmente.

---

## 🎯 Aprendizajes del proyecto

El desarrollo de WISAND me permitió adquirir experiencia práctica en:

- Diseño y desarrollo de APIs REST.
- Desarrollo backend con Node.js y Express.
- Consultas SQL y bases de datos relacionales.
- Autenticación y control de acceso.
- Arquitectura multiempresa.
- Desarrollo de aplicaciones móviles.
- Construcción de interfaces comerciales.
- Integración entre componentes de software.
- Organización del código y documentación técnica.
- Uso de Git y GitHub.

---

## 👨‍💻 Desarrollador

**Wilfer Edisson Duero Mateus**

Técnico Laboral en Programación de Software.

Interesado en el desarrollo web, backend y aplicaciones que permitan resolver problemas reales mediante software.

💻 **GitHub:** [WilferDuero](https://github.com/WilferDuero)

💼 **LinkedIn:** [Wilfer Duero](https://www.linkedin.com/in/wilfer-duero)

---

**Licencia:** ISC

⭐ Proyecto incluido en mi portafolio personal de desarrollo de software.
