self.onmessage = function (e: MessageEvent) {
    if (e.data === 'start') {
        if ((self as any).timerId) clearInterval((self as any).timerId);
        (self as any).timerId = setInterval(function () {
            postMessage('tick');
        }, 1000);
    } else if (e.data === 'stop') {
        if ((self as any).timerId) clearInterval((self as any).timerId);
    }
};
