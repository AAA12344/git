const fs=require('fs');
const files=['app.js',...fs.readdirSync('src/modules',{recursive:true}).filter(name=>name.endsWith('.js')).map(name=>'src/modules/'+name.replace(/\\/g,'/'))];
const errors=[];
for(const file of files){const source=fs.readFileSync(file,'utf8');if(source.includes('>详情</button>'))errors.push(file+' 仍有操作按钮显示“详情”');if(/actionDef\([^\n]+["\']详情["\']/.test(source))errors.push(file+' 仍有操作定义显示“详情”');}
const app=fs.readFileSync('app.js','utf8');
for(const file of files){
  const source=fs.readFileSync(file,'utf8');
  for(const match of source.matchAll(/actionDef\(\s*(['"])[^'"]+\1\s*,\s*(['"])([^'"]+)\2/g)){
    if([...match[3]].length!==2) errors.push(file+' 操作定义不是两个字：'+match[3]);
  }
  for(const cell of source.matchAll(/operation-cell[\s\S]{0,1200}?(?:<\/td>|\x60)/g)){
    for(const button of cell[0].matchAll(/>([^<>+'"$\x60{}]+)<\/button>/g)){
      const label=button[1].trim();
      if(label&&[...label].length!==2) errors.push(file+' 操作单元格按钮不是两个字：'+label);
    }
  }
}
if(!/const OPERATION_ORDER = \[[^\n]+,'view','detail'\];/.test(app)) errors.push('默认操作顺序未将查看置于最后');
if((app.match(/viewBeforeDownload:true/g)||[]).length<2) errors.push('查询导出的查看、下载例外顺序未完整配置');
if(app.includes('"撤回申请", "withdraw-export-request"')) errors.push('查询导出仍显示“撤回申请”');
if(!/actionDef\("export", "导出", "rectification-export", "批量导出"\)[^\n]+actionDef\("detail", "查看", "rectification-detail"\)/.test(app)) errors.push('溯源整改导出未将查看置于最后');
for(const file of files.filter(name=>name.includes('complaints/rectification/'))){const source=fs.readFileSync(file,'utf8');if(source.includes('催办')||source.includes('"remind"'))errors.push(file+' 溯源整改仍保留催办操作');}

for(const token of ['return-approval','批量退回','退回审批工单'])if(app.includes(token))errors.push('app.js 仍保留已废弃操作：'+token);
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log('Operation label checks passed.');
