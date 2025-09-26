import { createElement } from 'react';
import { render, unmountComponentAtNode } from 'react-dom';

class ReactComponentWrapper {
    _container: any;
    _tag: any;

    static wrap(tag) {
        return class extends ReactComponentWrapper {
            constructor(...args) {
                super(tag, ...args);
            }
        };
    }

    get container() {
        return this._container;
    }

    get tag() {
        return this._tag;
    }

    constructor(tag, props = {}, container = document.createElement('div')) {
        this._container = container;
        this._tag = tag;
        this.update(props);
    }

    update(props) {
        render(createElement(this.tag, props), this.container);
    }

    unmountFromContainer() {
        unmountComponentAtNode(this.container);
    }
}

export { ReactComponentWrapper };
