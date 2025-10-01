/**
 * @function ParserFunction
 * @param {XMLElement} element
 * @returns {Object}
 */

/**
 * Parses a <Position> node with 2 or 3 numbers.
 * @param {XMLElement} node
 * @returns {{x: Number, y: Number, z: Number}}
 */
function parsePosition(node) {
    const positions = node.innerHTML.split(' ').map(v => parseFloat(v));
    return {
        x: positions[0],
        y: positions[1],
        z: positions[2] || 0.0,
    };
}

/**
 * Parses a <Quaternion> node with 4 numbers.
 * @param {XMLElement} node
 * @returns {{x: Number, y: Number, z: Number, w: Number}}
 */
function parseQuaternion(node) {
    const values = node.innerHTML.split(' ');
    return {
        x: parseFloat(values[0]),
        y: parseFloat(values[1]),
        z: parseFloat(values[2]),
        w: parseFloat(values[3]),
    };
}

/**
 * Parses a node with <RMC_Site> and <RMC_Drive> children.
 * @param {XMLElement} node
 * @returns {{rmcSite: Number}}
 */
function parseRMCSite(node) {
    let rmcSite = -1;
    if (node.querySelector('RMC_Site')) {
        rmcSite = parseInt(node.querySelector('RMC_Site').innerHTML);
    }

    return { rmcSite };
}

/**
 * Parses a <Rectangle> node.
 * @param {XMLElement} node
 * @returns {{position: Object, angle: Number, halfWidth: Number, halfHeight: Number}}
 */
function parseRectangle(node) {
    const position = parsePosition(node.querySelector('Position'));
    const angle = parseFloat(node.querySelector('Angle').innerHTML);

    const dimensionNode = node.querySelector('Dimensions').innerHTML.split(' ');
    const halfWidth = parseFloat(dimensionNode[0]);
    const halfHeight = parseFloat(dimensionNode[1]);

    return {
        position,
        angle,
        halfWidth,
        halfHeight,
    };
}

/**
 * Parses a <Triangle> node.
 * @param {XMLElement} node
 * @returns {{points: Array<Object>}}
 */
function parseTriangle(node) {
    const points = node.querySelectorAll('Point');
    const p0 = parsePosition(points[0]);
    const p1 = parsePosition(points[1]);
    const p2 = parsePosition(points[2]);

    return {
        points: [p0, p1, p2],
    };
}

/**
 * Parses a <Circle> node.
 * @param {XMLElement} node
 * @returns {{position: Object, radius: Number}}
 */
function parseCircle(node) {
    const position = parsePosition(node.querySelector('Position'));
    const radius = parseFloat(node.querySelector('Radius').innerHTML);
    return {
        position,
        radius,
    };
}

/**
 * Parse the entire rover state out of an XML node and return an object with key being the name and value being the html content
 * For example, <Knot Name="ARM_NAMED_TARGET_3_POSE_FULL_Z">0.000000</Knot>
 * {'ARM_NAMED_TARGET_3_POSE_FULL_Z': 0.0}
 * @param {XMLElement} node
 * @return {Object<String, Number>}
 */
function parseRoverState(node) {
    const knots = node.querySelectorAll('Knot');
    const result = {};
    for (let i = 0, l = knots.length; i < l; i++) {
        const knot = knots[i];
        result[knot.getAttribute('Name')] = parseFloat(knot.innerHTML);
    }
    return result;
}

export {
    parsePosition,
    parseQuaternion,
    parseRectangle,
    parseTriangle,
    parseCircle,
    parseRMCSite,
    parseRoverState,
};
