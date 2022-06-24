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
}

async function startBrowser() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    setTimeout(async () => {
        await browser.close();
    }, 60000 * 4);

    return {browser, page};
}

/**
 * Get a list of tasks with puppeteer from the random list generator url
 */
const getTaskList = async ({browser}) => {
    const page = await browser.newPage();

    await page.goto(RANDOM_LIST_URL, {
        waitUntil: 'networkidle2'
    });

    return await page.evaluate( ():ITasks => { 
        const tasks : Array<ITask> = [];        
        const taskDivs = document.querySelectorAll('.card-body') 

        for (const div of taskDivs) {
            if(tasks.length > 4) break;

            const labels = Array.from(div.querySelectorAll('.tags.badge'),({textContent})=> textContent );

            tasks.push({
                title: div.querySelector('.task-title > div').textContent,
                description: div.querySelector('.card-text').textContent,
                labels,
                time: div.querySelector('.task-title > span').textContent
            })           
        }

        return {
            tasks
        };
    });
}

(async ()=>{
    try {
        const {browser,page} = await startBrowser();
        const {tasks} = await getTaskList({browser});

        const selectors = {
            email: '#labeled-input-1',
            pass:'#labeled-input-3',
            log:'//button[contains(., "Log in")]',
            submitTask:'//button[contains(., "Add task")]',
            addTask:'.plus_add_button',
            createTag:'.popper > div > ul > li:last-child',
            toggleTag: '.popper > div > ul > li',
            editTitle: '.public-DraftEditor-content',
            newTagInput: '.popper > div > div > input',
            addTag: '.task_editor__extra_fields > div:nth-child(2) > button',
            newTagTitle : '.richtextinput'
        }

        const url_auth = 'https://todoist.com/auth/login';
        const {PASSWORD,EMAIL} = process.env;
        page.setViewport({width: 1024, height: 920});

        await page.goto(url_auth);

        await page.click(selectors.email);
        await page.keyboard.type(EMAIL);

        await page.click(selectors.pass);
        await page.keyboard.type(PASSWORD);

        const [loginButton] = await page.$x(selectors.log);
        
         await Promise.all([
            loginButton.click(),
            page.waitForNavigation({waitUntil:'networkidle2'}),
        ]);

        const addTaskButton = await page.waitForSelector(selectors.addTask,{visible:true,timeout:0});
        await addTaskButton.click();
        await page.keyboard.type(' ')

        for(const task of tasks){
    
            await page.keyboard.type(task.title)
            await page.keyboard.press('Tab')
            await page.keyboard.type(`${task.description} \n Time to complete: ${task.time}`)

            await page.click(selectors.addTag);
    
            for(const tag of task.labels){
                await page.keyboard.type(tag)            
                const toggleButton = await page.waitForSelector(selectors.toggleTag)
                const toggleValue = await toggleButton.evaluate(el => el.textContent);
                if(toggleValue.trim() === 'Label not found')
                    await page.click(selectors.createTag)
                else await toggleButton.click(); 
    
                await page.click(selectors.newTagInput);        
                for(let ix = 0;ix < tag.length; ix++)
                    await page.keyboard.press('Backspace');        
            }
    
            await page.click(selectors.addTag);
            const [submitButton] = await page.$x(selectors.submitTask);
            await submitButton.click();
            await page.click(selectors.newTagTitle);

        }

    
        
    } catch (error) {
        console.error(error)
    }
})();