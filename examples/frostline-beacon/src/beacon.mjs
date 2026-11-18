/** Connect the scene's signal state to its independent lens, glow, receiver and light. */
export function createBeacon(config, items) {
  const lens = items.find(item => item.id === config.lens);
  const glow = items.find(item => item.id === config.glow);
  const receiver = items.find(item => item.id === config.receiver);
  if (!lens || !glow || !receiver) throw Error('The beacon requires lens, glow and receiver instances');

  const light = {...config.light};
  let enabled = true;
  let angle = receiver.yaw ?? 0;
  let lastTime = 0;

  return {
    light,
    get enabled() { return enabled; },
    get receiverYaw() { return angle; },
    toggle() { enabled = !enabled; },
    update(time) {
      if (enabled && time >= lastTime) angle += (time - lastTime) * config.angularSpeed;
      lastTime = time;
      receiver.yaw = angle;
      const pulse = .93 + .07 * Math.cos(time * Math.PI);
      lens.intensity = enabled ? pulse : .16;
      glow.alpha = enabled ? pulse : 0;
      light.intensity = enabled ? config.light.intensity * pulse : 0;
    },
  };
}
