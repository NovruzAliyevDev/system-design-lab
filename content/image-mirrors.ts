// The solution write-ups show their diagrams from imgur. These are the same diagrams in the primer
// repo, so Solution pages serve them with the site and keep working offline. Each solution's first
// (high-level) diagram is its `<name>_basic.png` and its last (scaled) one is `<name>.png`, also
// copied into `images/`; the scaling_aws steps were matched to `scaling_aws_<n>.png` by their content.
export const imageMirrors: Record<string, string> = {
  'http://i.imgur.com/BKsBnmG.png': 'solutions/system_design/pastebin/pastebin_basic.png',
  'http://i.imgur.com/4edXG0T.png': 'images/4edXG0T.png',
  'http://i.imgur.com/48tEA2j.png': 'solutions/system_design/twitter/twitter_basic.png',
  'http://i.imgur.com/jrUBAF7.png': 'images/jrUBAF7.png',
  'http://i.imgur.com/xjdAAUv.png': 'solutions/system_design/web_crawler/web_crawler_basic.png',
  'http://i.imgur.com/bWxPtQA.png': 'images/bWxPtQA.png',
  'http://i.imgur.com/E8klrBh.png': 'solutions/system_design/mint/mint_basic.png',
  'http://i.imgur.com/V5q57vU.png': 'images/V5q57vU.png',
  'http://i.imgur.com/wxXyq2J.png': 'solutions/system_design/social_graph/social_graph_basic.png',
  'http://i.imgur.com/cdCv5g7.png': 'images/cdCv5g7.png',
  'http://i.imgur.com/KqZ3dSx.png': 'solutions/system_design/query_cache/query_cache_basic.png',
  'http://i.imgur.com/4j99mhe.png': 'images/4j99mhe.png',
  'http://i.imgur.com/vwMa1Qu.png': 'solutions/system_design/sales_rank/sales_rank_basic.png',
  'http://i.imgur.com/MzExP06.png': 'images/MzExP06.png',
  // scaling_aws: the high-level design, then Users+ to Users+++++.
  'http://i.imgur.com/B8LDKD7.png': 'solutions/system_design/scaling_aws/scaling_aws.png',
  'http://i.imgur.com/rrfjMXB.png': 'solutions/system_design/scaling_aws/scaling_aws_2.png',
  'http://i.imgur.com/raoFTXM.png': 'solutions/system_design/scaling_aws/scaling_aws_3.png',
  'http://i.imgur.com/OZCxJr0.png': 'solutions/system_design/scaling_aws/scaling_aws_4.png',
  'http://i.imgur.com/3X8nmdL.png': 'solutions/system_design/scaling_aws/scaling_aws_5.png',
  'http://i.imgur.com/jj3A5N8.png': 'images/jj3A5N8.png',
}
