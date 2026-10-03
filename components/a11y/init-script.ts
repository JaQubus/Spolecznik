// Wstrzykiwany do <head>: przywraca ustawienia dostępności przed pierwszym renderem (bez mignięcia).
export const A11Y_INIT_SCRIPT = `try{["large","contrast","simple"].forEach(function(k){if(localStorage.getItem("a11y-"+k)==="1")document.documentElement.classList.add("a11y-"+k)})}catch(e){}`;
