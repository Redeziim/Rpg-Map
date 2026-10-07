const sessionPoses=new Map();
const keyFor=(userId,roomId)=>`grimorio:camera:v1:${userId}:${roomId}`;
function validPose(pose){
  if(!pose||!['position','target'].every(key=>Array.isArray(pose[key])&&pose[key].length===3&&pose[key].every(value=>Number.isFinite(value)&&Math.abs(value)<=20000)))return false;
  const distance=Math.hypot(...pose.position.map((value,index)=>value-pose.target[index]));return distance>=.149&&distance<=5001;
}
export function readCameraPreference(userId,roomId){
  const key=keyFor(userId,roomId);if(sessionPoses.has(key))return sessionPoses.get(key);
  try{const saved=JSON.parse(localStorage.getItem(key));if(saved?.version===1&&validPose(saved))return {position:saved.position,target:saved.target};}catch{}
  return null;
}
export function writeCameraPreference(userId,roomId,pose){
  if(!validPose(pose))return false;
  const key=keyFor(userId,roomId),copy={position:[...pose.position],target:[...pose.target]};sessionPoses.set(key,copy);
  if(sessionPoses.size>50)sessionPoses.delete(sessionPoses.keys().next().value);
  try{localStorage.setItem(key,JSON.stringify({version:1,...copy}));return true;}catch{return false;}
}
