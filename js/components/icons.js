function icon(name, size = 20) {
    // Map existing camelCase icon names (e.g. chevronLeft, share2) to valid lucide kebab-case names
    const lucideName = name.replace(/([a-zA-Z])(?=[A-Z])/g, '$1-').replace(/([a-zA-Z])(\d+)/g, '$1-$2').toLowerCase();
    return `<i data-lucide="${lucideName}" width="${size}" height="${size}" stroke-width="1.8"></i>`;
}
