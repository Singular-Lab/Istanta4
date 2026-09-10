document.addEventListener('DOMContentLoaded', function() {
    const trigger = document.getElementById('trigger-popover');
    const popover = document.getElementById('my-popover');

    trigger.addEventListener('click', function() {
        if (popover.hasAttribute('open')) {
            popover.removeAttribute('open');
        } else {
            popover.setAttribute('open', '');
        }
    });
});