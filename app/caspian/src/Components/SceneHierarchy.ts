class DefaultObjectInfo {
    constructor() {
        this.priority = 0;
    }

    canHandle(obj) {
        return true;
    }

    update(obj, info) {
        info.name = obj.name || obj.type;
        info.isLeaf = obj.children.length === 0;
    }

    getDetails(obj, details) {
        return null;
    }
}

const INFO_CLASS = Symbol('Info Class');
export class SceneHierarchy {
    constructor(scene) {
        this.scene = scene;
        this.cachedInfo = new WeakMap();
        this.displayList = [];
        this.infoClasses = [new DefaultObjectInfo()];

        this.cachedDetails = null;
        this.lastDetailObj = null;

        this.setExpanded(scene, true);

        // TODO: this is temporary -- move it out when the hierarchy implementation is complete
        this.registerInfoClass({
            priority: 1,
            canHandle(obj) {
                return obj.isURDFRobot;
            },
            update(obj, info) {
                info.name = obj.name;
                info.isLeaf = true;
            },
            getDetails(obj, target) {
                let count = 0;
                for (const key in obj.joints) {
                    const joint = obj.joints[key];

                    if (joint.jointType !== 'continuous' && joint.jointType !== 'revolute') {
                        continue;
                    }
                    if (target.length <= count) {
                        target.push({});
                    }

                    const details = target[count];
                    details.name = key;
                    details.label = key;
                    details.value = joint.angle;
                    details.readOnly = true;

                    count++;
                }

                window.detailsTarget = target;
                target.sort((a, b) => {
                    if (a.name === b.name) {
                        return 0;
                    } else {
                        return a.name < b.name ? -1 : 1;
                    }
                });
            },
        });
    }

    _initInfo(obj) {
        const cachedInfo = this.cachedInfo;
        let info = cachedInfo.get(obj);
        if (!info) {
            info = {
                key: obj.uuid,
                name: '',
                depth: 0,
                expanded: false,
                isLeaf: false,
                object: obj,
                [INFO_CLASS]: null,
            };
            cachedInfo.set(obj, info);
        }
        return info;
    }

    setExpanded(obj, state) {
        const info = this._initInfo(obj);
        info.expanded = state;
    }

    update() {
        const scope = this;
        const infoClasses = this.infoClasses;
        const displayList = this.displayList;
        displayList.length = 0;
        traverse(this.scene);

        function traverse(obj, depth = 0) {
            if (!obj.visible) return;
            if ((obj.layers.mask & 1) === 0) return;

            const info = scope._initInfo(obj);
            let desc = info[INFO_CLASS];
            if (!desc) {
                for (let i = 0, l = infoClasses.length; i < l; i++) {
                    const item = infoClasses[i];
                    if (item.canHandle(obj)) {
                        desc = item;
                        break;
                    }
                }
                info[INFO_CLASS] = desc;
            }

            info.depth = depth;
            desc.update(obj, info);
            displayList.push(info);

            if (!info.isLeaf && info.expanded) {
                const children = obj.children;
                for (let i = 0, l = children.length; i < l; i++) {
                    traverse(children[i], depth + 1);
                }
            }
        }
    }

    registerInfoClass(desc) {
        const infoClasses = this.infoClasses;
        infoClasses.push(desc);
        infoClasses.sort((a, b) => b.priority - a.priority);
    }

    getDetails(obj) {
        if (obj !== this.lastDetailObj) {
            this.details = [];
            this.lastDetailObj = obj;
        }

        const details = this.details;
        const info = this._initInfo(obj);
        const infoClass = info[INFO_CLASS];
        infoClass.getDetails(obj, details);

        return details;
    }

    getInfo(obj) {
        const info = this._initInfo(obj);
        return info;
    }
}
