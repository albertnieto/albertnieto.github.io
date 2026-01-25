/**
 * Theme Switcher & Shader Integration
 * Handles Light/Dark mode toggling and syncs with fusion-shader.js
 */

(function () {
    // 1. Check for saved preference or system default
    const savedTheme = localStorage.getItem('theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    let isDark = savedTheme === 'dark' || (!savedTheme && systemDark);

    // 2. Apply initial state
    if (isDark) {
        document.body.classList.add('dark-mode');
    }

    // 3. Create Toggle Button
    const btn = document.createElement('button');
    btn.id = 'theme-toggle';
    btn.innerHTML = getIcon(isDark);
    btn.title = 'Toggle Theme';

    // Attempt to inject into Masthead (Top Bar)
    const masthead = document.querySelector('.masthead__inner-wrap');
    if (masthead) {
        btn.classList.add('in-navbar'); // Add class for specific styling
        masthead.appendChild(btn);
    } else {
        document.body.appendChild(btn);
    }

    // 4. Handle Click
    btn.addEventListener('click', () => {
        isDark = !isDark;
        if (isDark) {
            document.body.classList.add('dark-mode');
            localStorage.setItem('theme', 'dark');
        } else {
            document.body.classList.remove('dark-mode');
            localStorage.setItem('theme', 'light');
        }
        btn.innerHTML = getIcon(isDark);

        // Notify Shader
        if (window.setShaderTheme) {
            window.setShaderTheme(isDark);
        }
    });

    // 5. Expose current state for Shader init
    window.isDarkMode = () => isDark;

    // Helper: SVG Icons
    function getIcon(dark) {
        if (dark) {
            // Moon Icon (for Dark Mode active) or Sun? Usually show what switching TO or current state.
            // Let's show the Sun icon when in Dark Mode (click to switch to light)
            return '<svg viewBox="0 0 24 24"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/></svg>';
        } else {
            // Moon Icon
            return '<svg viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/></svg>';
        }
    }
})();
