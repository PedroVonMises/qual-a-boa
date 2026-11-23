import { dispatchNodeRequest, type NodeLikeRequest, type NodeLikeResponse } from './_engine';

export default function handler(req: NodeLikeRequest, res: NodeLikeResponse) {
  dispatchNodeRequest(req, res);
}
