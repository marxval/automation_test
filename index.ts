import puppeteer from "puppeteer";
import { TodoistApi } from '@doist/todoist-api-typescript'
import 'dotenv/config' 

const RANDOM_LIST_URL = 'https://randomtodolistgenerator.herokuapp.com/library';

interface ITask {
    title: string,
    description: string,
    labels: Array<string>,
    time: string
}

interface ITasks {
    tasks: Array<ITask>,
    labels: Array<string>
}

/**
 * Get a list of tasks with puppeteer from the random list generator url
 */
const getTaskList = async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.goto(RANDOM_LIST_URL, {
        waitUntil: 'networkidle2'
    });


    setTimeout(async () => {
        await browser.close();
    }, 60000 * 4);


    return await page.evaluate( ():ITasks => { 
        const tasks : Array<ITask> = [];        
        const taskDivs = document.querySelectorAll('.card-body') 
        const set_of_labels = new Set<string>();

        for (const div of taskDivs) {
            if(tasks.length > 4) break;

            const labels = Array.from(div.querySelectorAll('.tags.badge'),({textContent})=> textContent );
            labels.forEach(label=>set_of_labels.add(label))

            tasks.push({
                title: div.querySelector('.task-title > div').textContent,
                description: div.querySelector('.card-text').textContent,
                labels,
                time: div.querySelector('.task-title > span').textContent
            })           
        }

        return {
            tasks,
            labels: Array.from(set_of_labels)
        };
    });
}

/**
 * Add tasks to Todoist in a new project 
 */
const addTaskToDoist = async ({labels,tasks}:ITasks) => {
    const todo_api = new TodoistApi(`${process.env.API_TOKEN}`);
    const labels_map = new Map<string,number>();

    // Add new labels to todoist labels 
    const existing_labels = await todo_api.getLabels();
    existing_labels.forEach(({name,id})=>labels_map.set(name,id));

    labels.forEach( async (label)=>{
        if(!labels_map.has(label)){
            const {id} = await todo_api.addLabel({ name: label })
            labels_map.set(label,id)
        }
    })

    // Add tasks to todoist in a new project
    const project_name = `List - ${Date.now()}`;
    const { id:projectId } = await todo_api.addProject({ name: project_name })
        

    tasks.forEach(({title,description,labels,time})=>{
        const labels_ids = labels.map(label=>labels_map.get(label));       
        todo_api.addTask({
            content: title,
            projectId,
            description: `${description} \n Time to complete: ${time}`,
            labelIds: labels_ids
        })
    })

    return {
        project: project_name,
        total: tasks.length
    }
}

(async ()=>{
    try {
        const {labels,tasks} = await getTaskList();
        const {project,total} = await addTaskToDoist({labels,tasks})
        console.log(`${total} new tasks added to ${project}.`)        
    } catch (error) {
        console.error(error)
    }
})();