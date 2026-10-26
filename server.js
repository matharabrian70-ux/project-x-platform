const express=require('express');
const path=require('path');
const app=express();
const port=process.env.PORT||3000;
app.use(express.static(path.join(__dirname,'app')));
app.get('/health',(req,res)=>res.json({ok:true,service:'project-x-platform'}));
app.listen(port,()=>console.log(`Project X listening on ${port}`));
