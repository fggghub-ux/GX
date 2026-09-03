(function () {
    'use strict';

    const vendors = {
        mammoth: {
            src: 'https://unpkg.com/mammoth@1.8.0/mammoth.browser.min.js',
            isReady: () => !!window.mammoth?.extractRawText
        },
        jszip: {
            src: 'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js',
            isReady: () => !!window.JSZip?.loadAsync
        }
    };
    const pending = new Map();

    window.u2LoadVendorLibrary = function loadVendorLibrary(name) {
        const vendor = vendors[name];
        if (!vendor) return Promise.reject(new Error(`Unknown vendor library: ${name}`));
        if (vendor.isReady()) return Promise.resolve();
        if (pending.has(name)) return pending.get(name);

        const promise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = vendor.src;
            script.async = true;
            script.dataset.u2Vendor = name;
            script.onload = () => vendor.isReady()
                ? resolve()
                : reject(new Error(`${name} loaded without its expected global`));
            script.onerror = () => reject(new Error(`Failed to load ${name}`));
            document.head.appendChild(script);
        }).finally(() => pending.delete(name));

        pending.set(name, promise);
        return promise;
    };
})();
