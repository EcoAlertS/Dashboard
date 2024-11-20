const reportsContainer = document.getElementById('reports-container');
const listReportsBtn = document.getElementById('listReportsBtn');
const totalReportsElement = document.getElementById('totalReports');
const activeReportsElement = document.getElementById('activeReports');
const resolvedReportsElement = document.getElementById('resolvedReports');
const localityStatsTable = document.getElementById('localityStatsTable').querySelector('tbody');
const searchInput = document.getElementById('searchInput');

let reports = []; // Variable global para almacenar los reportes cargados
let currentFilter = null; // Variable para almacenar el filtro actual


function isTokenExpired(token) {
    if (!token) return true;
    
    try {
        const [, payload] = token.split('.');
        const decodedPayload = JSON.parse(atob(payload));
        const currentTime = Math.floor(Date.now() / 1000);
        
        return decodedPayload.exp < currentTime;
    } catch (e) {
        console.error('Error al decodificar token:', e);
        return true;
    }
}

// Función para verificar autenticación
async function verificarAutenticacion() {
    const token = localStorage.getItem("authToken");
    
    if (!token) {
        throw new Error("No hay token disponible");
    }

    // Verificar primero si el token está expirado localmente
    if (isTokenExpired(token)) {
        throw new Error("Token expirado");
    }

    const response = await fetch("https://svrecoalert-sql.onrender.com/verify-token", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Error de autenticación");
    }

    return await response.json();
}

// Función para manejar la redirección al login
function redirectToLogin(message) {
    localStorage.removeItem("authToken");
    localStorage.removeItem("usuario");
    alert(message || "Sesión finalizada. Por favor, inicie sesión nuevamente.");
    window.location.href = "index.html";
}

// Inicialización del dashboard
document.addEventListener("DOMContentLoaded", async () => {
    try {
        // Verificar autenticación
        const authData = await verificarAutenticacion();
        //console.log("Sesión válida. Bienvenido:", authData.usuario);
        
        // Si la autenticación es exitosa, inicializar el dashboard
        await fetchReports();
        
    } catch (error) {
        console.error("Error de autenticación:", error.message);
        redirectToLogin(error.message);
    }
});

// Función para realizar peticiones autenticadas
async function authenticatedFetch(url, options = {}) {
    const token = localStorage.getItem("authToken");
    
    if (!token || isTokenExpired(token)) {
        redirectToLogin("Sesión expirada");
        throw new Error("Token no válido");
    }

    const defaultOptions = {
        headers: {
            "Authorization": `Bearer ${token}`,
            ...options.headers
        }
    };

    try {
        const response = await fetch(url, {
            ...options,
            ...defaultOptions,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        });

        if (!response.ok) {
            const data = await response.json();
            if (response.status === 401) {
                redirectToLogin(data.error);
                throw new Error(data.error);
            }
            throw new Error(data.error || "Error en la petición");
        }

        return await response.json();
    } catch (error) {
        if (error.message.includes("Token")) {
            redirectToLogin(error.message);
        }
        throw error;
    }
}

function fetchReports() {
    fetch('https://svrecoalert-sql.onrender.com/reports')
        .then(response => {
            if (!response.ok) throw new Error('Error en la API: ' + response.status);
            return response.json();
        })
        .then(data => {
            reports = data;
            renderReports();
        })
        .catch(error => console.error('Error al obtener los reportes:', error));
}

function renderReports(filteredReports = reports) {
    reportsContainer.innerHTML = '';
    localityStatsTable.innerHTML = '';

    let total = filteredReports.length;
    let active = 0;
    let resolved = 0;
    const localityStats = {};

    const reportFragment = document.createDocumentFragment();
    filteredReports.forEach(report => {
        if (report.state) active++;
        else resolved++;

        const locality = report.localidad || 'Sin Localidad';
        if (!localityStats[locality]) localityStats[locality] = { total: 0, active: 0, resolved: 0 };
        localityStats[locality].total++;
        if (report.state) localityStats[locality].active++;
        else localityStats[locality].resolved++;

        const card = document.createElement('div');
        card.className = 'col-md-4 mb-4 card-container';
        card.innerHTML = `
            <div class="card">
                <img src="${report.image_url || ''}" class="card-img-top" alt="${report.description || 'Descripción no disponible'}">
                <div class="card-body">
                    <p><strong>ID:</strong> ${report.id ?? 'No disponible'}</p>
                    <p><strong>Dirección:</strong> ${report.full_address || 'No disponible'}</p>
                    <p><strong>Localidad:</strong> ${report.localidad || 'No disponible'}</p>
                    <p><strong>Barrio:</strong> ${report.barrio || 'No disponible'}</p>
                    <p><strong>Email:</strong> ${report.correo_electronico || 'No disponible'}</p>
                    <p><strong>Descripción:</strong> ${report.description || 'No disponible'}</p>
                    <button class="btn ${report.state ? 'btn-success' : 'btn-secondary'}" onclick="toggleReportState(${report.id})">
                        <i class="fas ${report.state ? 'fa-check-circle' : 'fa-times-circle'}"></i> ${report.state ? 'Activo' : 'Solucionado'}
                    </button>
                    <button class="btn btn-danger m-3" onclick="deleteReport(${report.id})"><i class="fas fa-trash-alt"></i> Eliminar</button>
                </div>
            </div>`;
        reportFragment.appendChild(card);
    });
    reportsContainer.appendChild(reportFragment);

    totalReportsElement.textContent = total;
    activeReportsElement.textContent = active;
    resolvedReportsElement.textContent = resolved;

    Object.keys(localityStats).forEach(locality => {
        const stats = localityStats[locality];
        const row = document.createElement('tr');
        row.innerHTML = `<td>${locality}</td><td>${stats.total}</td><td>${stats.active}</td><td>${stats.resolved}</td>`;
        localityStatsTable.appendChild(row);
    });
}

function toggleReportState(id) {
    fetch(`https://svrecoalert-sql.onrender.com/report/${id}/toggle_state`, { method: 'PUT' })
        .then(response => {
            if (!response.ok) return alert('Error al cambiar el estado.');
            const report = reports.find(r => r.id === id);
            if (report) {
                report.state = !report.state;
                renderReports();
            }
        })
        .catch(error => console.error('Error al cambiar el estado:', error));
}

function deleteReport(id) {
    if (!confirm('¿Está seguro de que desea eliminar este reporte?')) return;
    fetch(`https://svrecoalert-sql.onrender.com/report/${id}`, { method: 'DELETE' })
        .then(response => {
            if (!response.ok) return alert('Error al eliminar el reporte.');
            reports = reports.filter(report => report.id !== id);
            renderReports();
            showNotification('Reporte eliminado exitosamente');
        })
        .catch(error => console.error('Error al eliminar el reporte:', error));
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} mt-3`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Función para filtrar los reportes
function filterReports(filterType) {
    let filteredReports = [];

    switch (filterType) {
        case 'ID':
            filteredReports = reports.sort((a, b) => a.id - b.id);
            break;
        case 'Localidad':
            filteredReports = reports.sort((a, b) => a.localidad.localeCompare(b.localidad));
            break;
        case 'Activos':
            filteredReports = reports.filter(report => report.state);
            break;
        case 'Resueltos':
            filteredReports = reports.filter(report => !report.state);
            break;
        default:
            filteredReports = reports;
            break;
    }

    currentFilter = filterType; // Guardamos el filtro actual
    renderReports(filteredReports);
}

// Función para borrar el filtro
function clearFilters() {
    currentFilter = null; // Restablecemos el filtro
    renderReports(); // Mostramos todos los reportes
}

// Función para buscar reportes por palabra clave
function searchReports(query) {
    const lowerCaseQuery = query.toLowerCase();
    const searchedReports = reports.filter(report => 
        (report.id && report.id.toString().includes(query)) ||
        (report.localidad && report.localidad.toLowerCase().includes(lowerCaseQuery)) ||
        (report.description && report.description.toLowerCase().includes(lowerCaseQuery))
    );

    renderReports(searchedReports);
}
// Función para filtrar los reportes por barrio o ID
function searchByIdOrBarrio(query) {
    const lowerCaseQuery = query.toLowerCase();

    const filteredReports = reports.filter(report => {
        const matchesId = report.id && report.id.toString().includes(lowerCaseQuery);
        const matchesBarrio = report.barrio && report.barrio.toLowerCase().includes(lowerCaseQuery);
        return matchesId || matchesBarrio;
    });

    renderReports(filteredReports);
}

// Agregar eventos
listReportsBtn.addEventListener('click', fetchReports);
document.addEventListener('DOMContentLoaded', fetchReports);
searchBar.addEventListener('input', (event) => {
    const query = event.target.value;
    searchByIdOrBarrio(query);
});

// Agregar eventos
listReportsBtn.addEventListener('click', fetchReports);
document.addEventListener('DOMContentLoaded', fetchReports);
document.getElementById('filterById').addEventListener('click', () => filterReports('ID'));
document.getElementById('filterByLocality').addEventListener('click', () => filterReports('Localidad'));
document.getElementById('filterByActive').addEventListener('click', () => filterReports('Activos'));
document.getElementById('filterByResolved').addEventListener('click', () => filterReports('Resueltos'));
document.getElementById('clearFilters').addEventListener('click', clearFilters); // Agregar el evento para borrar filtros
searchInput.addEventListener('input', (event) => searchReports(event.target.value));
