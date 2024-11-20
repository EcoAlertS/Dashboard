const API_URL = "https://svrecoalert-sql.onrender.com/verificar";

async function loguear() {
    // Obtener los valores ingresados por el usuario
    const usuario = document.getElementById("usuario").value;
    const contrasena = document.getElementById("clave").value;

    // Validar campos
    if (!usuario || !contrasena) {
        alert("Por favor, ingresa usuario y contraseña.");
        return;
    }

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ usuario, contrasena })
        });

        const data = await response.json();

        if (response.ok) {
            if (data.token) {
                // Guardar token y usuario en localStorage
                localStorage.setItem("authToken", data.token);
                localStorage.setItem("usuario", data.usuario);

                // Mostrar mensaje de éxito
                alert("Inicio de sesión exitoso");

                // Redireccionar al dashboard
                window.location.href = "dashboard.html";
            } else {
                alert("Error: No se recibió un token válido");
            }
        } else {
            // Mostrar mensaje de error específico del servidor
            alert(data.error || "Error al iniciar sesión");
        }
    } catch (error) {
        console.error("Error:", error);
        alert("Error de conexión. Por favor, intenta nuevamente.");
    }
}