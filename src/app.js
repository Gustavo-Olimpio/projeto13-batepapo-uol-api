import express from 'express'
import cors from 'cors'
import { MongoClient } from "mongodb"
import dotenv from 'dotenv'
import dayjs from 'dayjs'
import joi from 'joi'


// Criação do servidor
const app = express()

// Configurações
app.use(express.json())
app.use(cors())
dotenv.config()

// Setup do Banco de Dados (comando para iniciar o DB = mongod --dbpath ~/.mongo)
// Comando para matar porta: sudo kill -9 `sudo lsof -t -i:5000`
let db
const mongoClient = new MongoClient(process.env.DATABASE_URL)
mongoClient.connect()
    .then(() => db = mongoClient.db())
    .catch((err) => console.log(err.message))

// Endpoints
app.post("/participants", async (req, res) => {
const {name} = req.body
const nome = name
const user = {
    name : name,
    lastStatus: Date.now()
}
const userSchema = joi.object({
    name: joi.string().required(),
    lastStatus: joi.required()
})
const msg = {
    from: name,
    to: 'Todos',
    text: 'entra na sala...',
    type: 'status',
    time: dayjs().format('HH:mm:ss')
}

const validation = userSchema.validate(user, { abortEarly: false });
if (validation.error) {
    const errors = validation.error.details.map((detail) => detail.message);
    return res.status(422).send(errors);
  } 

try {
    if(await db.collection("participants").findOne({name:nome}))return res.sendStatus(409)
    await db.collection("participants").insertOne(user)
    await db.collection("messages").insertOne(msg)
    res.sendStatus(201)
} catch(err){
    res.status(500).send(err.message)
}

});

app.get("/participants",async (req, res) => {
    try{
        const lst = await db.collection("participants").find().toArray()
        res.status(200).send(lst)
    } catch(err){
        res.status(500).send(err.message)
    }
})

app.post("/messages", async (req, res) => {
   const from = req.headers.user
    const {to,text,type} = req.body

    const msgSchema = joi.object({
    from: joi.string(),
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid("message","private_message").required()
    })
    const msg =  {
        from: from,
        to:to,
        text:text,
        type:type
        
    }
    const validation = msgSchema.validate(msg, { abortEarly: false });
    if (validation.error) {
        const errors = validation.error.details.map((detail) => detail.message);
        return res.status(422).send(errors);
      } 
      try {
        if (!await db.collection("participants").findOne({name:from}))return res.sendStatus(422)
        await db.collection("messages").insertOne({...msg,time:dayjs().format('HH:mm:ss')})
        res.sendStatus(201)
    } catch(err){
        res.status(500).send(err.message)
    }
})



app.get("/messages",async (req, res) => {
    const from = req.headers.user
    const { limit } = req.query
    const msgLimit = []
    
    try{
        const lst = await db.collection("messages").find({
            $or: [
                { from: from },
                { to: 'Todos' },
                { to: from }
            ]
        }).toArray()
        if(limit <= 0 || isNaN(limit)) return res.sendStatus(422)
        if (!limit){
            res.status(200).send(lst)
        } else if(limit){
            let cont = limit
            if(limit > lst.length ){
                cont = lst.length
            }
            for(let i=0;i < cont ;i++){
                msgLimit.push(lst[lst.length -1])
                
            }
            res.status(200).send(msgLimit)
        } 
    } catch(err){
        res.status(500).send(err.message)
    }

})



app.post("/status",async (req, res) => {
    const from = req.headers.user
    if (!from)return res.sendStatus(404)
    try{
        if(!await db.collection("participants").findOne({name:from}))return res.sendStatus(404) 
        await db.collection("participants").updateOne({ name: from }, { $set: { lastStatus: Date.now() } });
        res.sendStatus(200)

    } catch(err){
        res.status(500).send(err.message)
    }
})
setInterval(attdados,15000)
async function attdados(){
    try{
        const lst = await db.collection("participants").find().toArray();
        for(let i=0;i<lst.length;i++){
            
            if(Date.now() - lst[i].lastStatus > 10000){
               db.collection("participants").deleteOne({name:lst[i].name});
               const msg={ 
                    from: lst[i].name,
                    to: 'Todos',
                    text: 'sai da sala...',
                    type: 'status',
                    time: dayjs().format('HH:mm:ss')
                }
                db.collection("messages").insertOne(msg);
                
            }
        }
    } catch(err){
        
    }
    
}

// Deixa o app escutando, à espera de requisições
const PORT = 5000
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`))